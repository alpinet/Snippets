-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
  insert into snippets (week_start, happened_on, title, visibility)
  values (date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 7, 'ramen', 'friends')
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
  insert into snippets (id, week_start, happened_on, title, visibility) values
    ('00000000-0000-0000-0000-0000000000f1', date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 6, 'just for me', 'private'),
    (gen_random_uuid(), date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 5, 'shared too', 'friends')
$$, 'up to three moments');
select throws_like($$
  insert into snippets (week_start, happened_on, visibility) values (date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 4, 'friends')
$$, '%up to 3 moments%', 'a fourth moment is rejected');

-- Reflection first: there is no default visibility.
select throws_ok($$
  insert into snippets (week_start, happened_on) values (date_trunc('week', now())::date - 14, date_trunc('week', now())::date - 14)
$$, '23502', null, 'a moment must be marked private or shared');
select throws_ok($$
  insert into snippets (week_start, happened_on, visibility) values (date_trunc('week', now())::date - 14, date_trunc('week', now())::date - 14, 'public')
$$, '23514', null, 'only private or friends is allowed');

-- Friend B (who kept that week) sees A's two shared moments but never the private one.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from snippets), 2, 'friends see shared moments only');
select is((select count(*)::int from snippets where title = 'just for me'), 0, 'a private moment stays private');
select throws_ok($$
  insert into reactions (snippet_id, kind) values ('00000000-0000-0000-0000-0000000000f1', 'heart')
$$, '42501', null, 'cannot react to a private moment');
reset role;
select is(
  (select count(*)::int from (select can_view_snippet(id) v from snippets where title = 'just for me') x where v),
  0, 'private media/comments are gated too');
set local role authenticated;

-- Keeping a week with only private moments still unlocks friends' shared moments.
reset role;
update weeks set status = 'draft' where user_id = '00000000-0000-0000-0000-00000000000b';
insert into snippets (user_id, week_start, happened_on, title, visibility) values
  ('00000000-0000-0000-0000-00000000000b', date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 7, 'quiet week', 'private');
update weeks set status = 'published' where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select is((select count(*)::int from snippets where user_id = '00000000-0000-0000-0000-00000000000a'), 2,
  'a privately kept week unlocks friends'' shared moments');

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
