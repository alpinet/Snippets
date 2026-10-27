-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Users: A and B are friends, C is a stranger.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev');
insert into friendships (requester_id, recipient_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- A drafts a moment in last week (past weeks can be written any time).
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select lives_ok($$
  insert into snippets (week_start, happened_on, title)
  values (date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 7, 'ramen')
$$, 'owner can create a snippet in a past week');
select is((select count(*)::int from snippets), 1, 'owner sees own draft');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from snippets), 0, 'friend cannot see a draft');

-- A shares; B hasn't → still locked.
reset role;
update weeks set status = 'published' where user_id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select is((select count(*)::int from snippets), 0, 'locked until the viewer shares that week');

-- B backfills that week → still locked (backfill never unlocks).
reset role;
insert into weeks (user_id, week_start, status)
  values ('00000000-0000-0000-0000-00000000000b', date_trunc('week', now())::date - 7, 'backfilled');
set local role authenticated;
select is((select count(*)::int from snippets), 0, 'backfilling does not unlock friends');

-- B had actually shared live → unlocked.
reset role;
update weeks set status = 'published' where user_id = '00000000-0000-0000-0000-00000000000b';
set local role authenticated;
select is((select count(*)::int from snippets), 1, 'unlocked after the viewer shares');
select lives_ok($$ insert into reactions (snippet_id, kind) select id, 'heart' from snippets $$, 'friend can react');

-- C (not a friend) sees nothing even though both shared.
reset role;
insert into weeks (user_id, week_start, status)
  values ('00000000-0000-0000-0000-00000000000c', date_trunc('week', now())::date - 7, 'published');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
select is((select count(*)::int from snippets), 0, 'strangers see nothing');

-- Limits: 3 moments per week.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$
  insert into snippets (week_start, happened_on) values
    (date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 6),
    (date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 5)
$$, 'up to three moments');
select throws_like($$
  insert into snippets (week_start, happened_on) values (date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 4)
$$, '%up to 3 moments%', 'a fourth moment is rejected');

-- Hardening: blank comments rejected; blocking hides comments and prevents re-adding.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_like($$ insert into comments (snippet_id, body) select id, '   ' from snippets limit 1 $$,
  '%comments_body_not_blank%', 'whitespace-only comments are rejected');
select lives_ok($$ insert into comments (snippet_id, body) select id, 'nice' from snippets limit 1 $$, 'friend can comment');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select block_user('00000000-0000-0000-0000-00000000000b');
select throws_like($$ select send_friend_request('00000000-0000-0000-0000-00000000000b') $$,
  '%can''t add this person%', 'blocked people cannot be re-added');

select * from finish();
rollback;
