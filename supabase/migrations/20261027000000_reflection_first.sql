-- Reflection first (docs/REFLECTION_PLAN.md, decisions of Oct 27, 2026).
--   * Every moment is explicitly "just for me" (private) or "share with friends" (friends).
--     There is no default: the client must choose, so inserts without one fail.
--   * Keeping your week on Sunday (week status 'published') is what unlocks friends' weeks,
--     whether you shared anything or not.
--   * Friends only ever see moments marked 'friends'. Private moments, their media, reactions
--     and comments are visible to the owner alone.

alter table public.snippets add column visibility text check (visibility in ('private', 'friends'));
-- Anything written before this change was written to be shared.
update public.snippets set visibility = 'friends' where visibility is null;
alter table public.snippets alter column visibility set not null;

-- Visibility ----------------------------------------------------------------

-- Every friend-facing read (media, reactions, comments, storage objects) goes through this.
create or replace function public.can_view_snippet(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from snippets s
    where s.id = sid
      and (s.user_id = auth.uid() or (s.visibility = 'friends' and can_view_week(s.user_id, s.week_start)))
  )
$$;

drop policy "snippets visible" on public.snippets;
create policy "snippets visible" on public.snippets
  for select to authenticated using (
    user_id = auth.uid() or (visibility = 'friends' and can_view_week(user_id, week_start))
  );

-- Friends tab: "posted" means they kept their week; the count is only what they shared.
create or replace function public.friends_week_status(wk date)
returns table (friend_id uuid, posted boolean, snippet_count int, nudged boolean, unlocked boolean)
language sql stable security definer set search_path = public as $$
  select f.id,
         coalesce(w.status = 'published', false),
         (select count(*)::int from snippets s where s.user_id = f.id and s.week_start = wk
            and s.visibility = 'friends' and w.status = 'published'),
         exists (select 1 from nudges n where n.from_id = auth.uid() and n.to_id = f.id and n.week_start = wk),
         can_view_week(f.id, wk)
  from friend_ids(auth.uid()) as f(id)
  left join weeks w on w.user_id = f.id and w.week_start = wk
$$;

-- Sunday ritual ---------------------------------------------------------------

-- "Keep your week". Same name as before so existing clients and grants keep working.
create or replace function public.publish_week(wk date) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if wk <> user_week_start(uid) then raise exception 'Only this week can be kept'; end if;
  if extract(isodow from user_today(uid)) <> 7 then
    raise exception 'You can keep your week on Sunday';
  end if;
  if not exists (select 1 from snippets where user_id = uid and week_start = wk) then
    raise exception 'Add at least one moment first';
  end if;
  update weeks set status = 'published', published_at = now()
    where user_id = uid and week_start = wk and status = 'draft';
  -- Friends only hear about it if there's something for them to see.
  if exists (select 1 from snippets where user_id = uid and week_start = wk and visibility = 'friends') then
    perform notify_friends_posted(uid);
  end if;
end $$;

create or replace function public.notify_friends_posted(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f uuid; name text;
begin
  select coalesce(nullif(display_name, ''), username) into name from profiles where id = uid;
  for f in select friend_ids(uid) loop
    perform send_push(f, 'notify_friend_posted', 'Snippets', name || ' shared a few moments from their week.',
      jsonb_build_object('route', '/friends'));
  end loop;
end $$;

create or replace function public.nudge(friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare wk date := user_week_start(friend);
begin
  if not are_friends(auth.uid(), friend) then raise exception 'Not friends'; end if;
  if exists (select 1 from weeks where user_id = friend and week_start = wk and status = 'published') then
    return; -- already kept
  end if;
  insert into nudges (from_id, to_id, week_start) values (auth.uid(), friend, wk)
    on conflict do nothing;
  if found then
    perform send_push(friend, 'notify_nudges', 'Snippets',
      'A friend is thinking of you. How was your week?', jsonb_build_object('route', '/'));
  end if;
end $$;

-- Hourly job: gentle Sunday reminder at 6pm local, only if the week isn't kept yet.
create or replace function public.send_sunday_reminders() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select up.user_id, (now() at time zone up.timezone)::date as today
    from user_private up
    where up.notify_sunday
      and extract(isodow from (now() at time zone up.timezone)) = 7
      and extract(hour from (now() at time zone up.timezone)) = 18
      and up.last_sunday_reminder is distinct from (now() at time zone up.timezone)::date
  loop
    update user_private set last_sunday_reminder = r.today where user_id = r.user_id;
    if not exists (select 1 from weeks where user_id = r.user_id and week_start = r.today - 6
                   and status = 'published') then
      perform send_push(r.user_id, 'notify_sunday', 'Look back on your week',
        'Take a minute to keep the moments that mattered.', jsonb_build_object('route', '/'));
    end if;
  end loop;
end $$;

-- Re-assert after replacing (create or replace keeps grants, but be explicit for internal helpers).
revoke execute on function public.notify_friends_posted(uuid), public.send_sunday_reminders()
  from public, anon, authenticated;

-- Analytics: kept weeks are the primary measure; sharing is secondary --------

create or replace view analytics.weekly_reflection as
select
  w.week_start,
  count(*) filter (where w.status in ('published', 'backfilled')) as weeks_kept,
  count(*) filter (where w.status = 'published') as kept_on_sunday,
  count(*) filter (where w.status = 'published'
    and exists (select 1 from snippets s where s.user_id = w.user_id and s.week_start = w.week_start
                and s.visibility = 'friends')) as kept_and_shared,
  (select count(*) from snippets s where s.week_start = w.week_start and s.visibility = 'private') as private_moments,
  (select count(*) from snippets s where s.week_start = w.week_start and s.visibility = 'friends') as shared_moments
from weeks w
group by w.week_start
order by w.week_start desc;
