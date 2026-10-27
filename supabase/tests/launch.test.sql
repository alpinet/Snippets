-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test.dev'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.dev');
update profiles set display_name = 'Alex', username = 'alex_t' where id = '00000000-0000-0000-0000-0000000000a1';
update user_private set invite_code = 'a1a1a1a1a1a1' where user_id = '00000000-0000-0000-0000-0000000000a1';
insert into friendships (requester_id, recipient_id, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'accepted');

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Invite preview: display name only, and nothing for unknown codes. Works signed out (anon).
set local role anon;
select is(invite_preview('A1A1A1A1A1A1'), '{"display_name": "Alex"}'::jsonb, 'invite preview shows only the display name');
select is(invite_preview('ffffffffffff'), null, 'unknown invite codes reveal nothing');
reset role;

-- Column privileges: settings toggles are writable; timezone and invite code are not.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select lives_ok($$ update user_private set notify_replies = false where user_id = auth.uid() $$, 'can change notification prefs');
select throws_ok($$ update user_private set invite_code = 'zzzzzzzzzzzz' where user_id = auth.uid() $$,
  '42501', null, 'cannot rewrite invite code directly');

-- Analytics events: insert-only, own rows, and unreadable (even your own).
select lives_ok($$ insert into app_events (name) values ('app_open') $$, 'can log own event');
select throws_ok($$ insert into app_events (user_id, name) values ('00000000-0000-0000-0000-0000000000b1', 'app_open') $$,
  '42501', null, 'cannot log events as someone else');
select is((select count(*)::int from app_events), 0, 'events are not readable by users');
select throws_ok($$ select * from analytics.weekly_participation $$, '42501', null, 'metrics are not exposed to users');
reset role;

-- Reply notifications: a friend's comment on your shared moment is logged for a push (owner replies are not).
insert into weeks (user_id, week_start, status) values
  ('00000000-0000-0000-0000-0000000000a1', date_trunc('week', now())::date - 7, 'published'),
  ('00000000-0000-0000-0000-0000000000b1', date_trunc('week', now())::date - 7, 'published');
insert into snippets (id, user_id, week_start, happened_on, title) values
  ('00000000-0000-0000-0000-00000000c0de', '00000000-0000-0000-0000-0000000000a1',
   date_trunc('week', now())::date - 7, date_trunc('week', now())::date - 7, 'ramen');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
insert into comments (snippet_id, body) values ('00000000-0000-0000-0000-00000000c0de', 'looks great');
reset role;
select is((select count(*)::int from reply_push_log where snippet_id = '00000000-0000-0000-0000-00000000c0de'), 1,
  'a friend reply schedules one push for the owner');

select * from finish();
rollback;
