-- Run with: npx supabase test db
-- Phase 3: moment kinds, looking-back notes, weekly lines and month picks.
-- Notes, lines and picks are owner-only, even on moments shared with friends who can see them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- A and B are friends, C is a stranger.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test.dev'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.dev'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.dev');
insert into friendships (requester_id, recipient_id, status) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 'accepted');

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- A keeps a shared "first time" moment last week, with a note, a weekly line and a month pick.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select lives_ok($$
  insert into snippets (id, week_start, happened_on, title, visibility, kind)
  values ('00000000-0000-0000-0000-0000000000d1', date_trunc('week', now())::date - 7,
          date_trunc('week', now())::date - 7, 'first swim', 'friends', 'first_time')
$$, 'a moment can carry a kind');
select throws_ok($$
  insert into snippets (week_start, happened_on, visibility, kind)
  values (date_trunc('week', now())::date - 14, date_trunc('week', now())::date - 14, 'private', 'best_ever')
$$, '23514', null, 'only known kinds are allowed');
select lives_ok($$
  insert into snippets (week_start, happened_on, visibility)
  values (date_trunc('week', now())::date - 14, date_trunc('week', now())::date - 14, 'private')
$$, 'kind is optional');

select lives_ok($$
  insert into lookback_notes (snippet_id, body, written_on)
  values ('00000000-0000-0000-0000-0000000000d1', 'A month later, I still think about this.', current_date)
$$, 'owner can add a looking-back note');
select is((select count(*)::int from lookback_notes), 1, 'owner sees their note');
select throws_ok($$
  insert into lookback_notes (snippet_id, body) values ('00000000-0000-0000-0000-0000000000d1', '   ')
$$, '23514', null, 'blank notes are rejected');

select lives_ok($$
  insert into week_lines (week_start, line) values (date_trunc('week', now())::date - 7, 'A brave week.')
$$, 'owner can write a weekly line');
select lives_ok($$
  insert into month_picks (month, snippet_id)
  select date_trunc('month', happened_on)::date, id from snippets where id = '00000000-0000-0000-0000-0000000000d1'
$$, 'owner can pick a moment for its month');
select throws_ok($$
  insert into month_picks (month, snippet_id)
  select (date_trunc('month', happened_on) - interval '1 month')::date, id
  from snippets where id = '00000000-0000-0000-0000-0000000000d1'
$$, '42501', null, 'a month pick must come from that month');

-- Both keep that week, so B can see A's shared moment.
reset role;
update weeks set status = 'published'
  where user_id = '00000000-0000-0000-0000-0000000000a2' and week_start = date_trunc('week', now())::date - 7;
insert into weeks (user_id, week_start, status) values
  ('00000000-0000-0000-0000-0000000000b2', date_trunc('week', now())::date - 7, 'published');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
select is((select kind from snippets where id = '00000000-0000-0000-0000-0000000000d1'), 'first_time',
  'a friend can see the moment (and its kind) once shared');
select is((select count(*)::int from lookback_notes), 0, 'friends never see looking-back notes');
select is((select count(*)::int from week_lines), 0, 'friends never see weekly lines');
select is((select count(*)::int from month_picks), 0, 'friends never see month picks');

select throws_ok($$
  insert into lookback_notes (snippet_id, body) values ('00000000-0000-0000-0000-0000000000d1', 'hi')
$$, '42501', null, 'cannot add a note to someone else''s moment');
select throws_ok($$
  insert into lookback_notes (snippet_id, user_id, body)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', 'hi')
$$, '42501', null, 'cannot write a note as someone else');
select throws_ok($$
  insert into week_lines (user_id, week_start, line)
  values ('00000000-0000-0000-0000-0000000000a2', date_trunc('week', now())::date - 7, 'not yours')
$$, '42501', null, 'cannot write someone else''s weekly line');
select throws_ok($$
  insert into month_picks (month, snippet_id)
  select date_trunc('month', happened_on)::date, id from snippets where id = '00000000-0000-0000-0000-0000000000d1'
$$, '42501', null, 'cannot pick someone else''s moment');

-- Silent no-ops under RLS: B's update/delete touch nothing of A's.
update week_lines set line = 'hijacked';
delete from lookback_notes;
delete from week_lines;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select is((select line from week_lines), 'A brave week.', 'others cannot change your weekly line');
select is((select count(*)::int from lookback_notes), 1, 'others cannot delete your notes');

-- Strangers see nothing at all.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from lookback_notes) + (select count(*)::int from week_lines)
  + (select count(*)::int from month_picks), 0, 'strangers see no notes, lines or picks');

-- Deleting a moment takes its notes and month pick with it.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
delete from snippets where id = '00000000-0000-0000-0000-0000000000d1';
select is((select count(*)::int from lookback_notes), 0, 'notes go with their moment');
select is((select count(*)::int from month_picks), 0, 'month picks go with their moment');

select * from finish();
rollback;
