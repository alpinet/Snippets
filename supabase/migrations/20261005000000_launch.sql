-- Launch readiness: column-level write limits, reply notifications, moderation alerts,
-- invite previews for the web landing page, Apple token storage, first-party analytics.

-------------------------------------------------------------------------------
-- Tighter writes: users may only change the columns they're meant to.
-- (Row policies say *which rows*; column grants say *which fields*.)
-------------------------------------------------------------------------------

alter table public.user_private add column if not exists notify_replies boolean not null default true;

revoke update on public.user_private from authenticated;
grant update (notify_sunday, notify_nudges, notify_friend_posted, notify_replies) on public.user_private to authenticated;

revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_path) on public.profiles to authenticated;

-------------------------------------------------------------------------------
-- Server-only configuration and secrets (RLS on, no policies = service role only)
-------------------------------------------------------------------------------

create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
-- e.g. insert into app_config values ('moderation_webhook_url', 'https://hooks.slack.com/services/…');

create table if not exists public.auth_secrets (
  user_id             uuid primary key references public.profiles on delete cascade,
  apple_refresh_token text,
  apple_client_id     text, -- the bundle ID (native) or Services ID (web) that issued the token
  updated_at          timestamptz not null default now()
);
alter table public.auth_secrets enable row level security;

-------------------------------------------------------------------------------
-- Reply notifications: "Sarah replied to your moment." Owner only, at most hourly per moment.
-------------------------------------------------------------------------------

create table if not exists public.reply_push_log (
  snippet_id uuid primary key references public.snippets on delete cascade,
  last_sent  timestamptz not null
);
alter table public.reply_push_log enable row level security;

create or replace function public.notify_reply() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  name text;
begin
  select user_id into owner from snippets where id = new.snippet_id;
  if owner is null or owner = new.user_id then return new; end if;
  if exists (select 1 from reply_push_log where snippet_id = new.snippet_id and last_sent > now() - interval '1 hour') then
    return new;
  end if;
  insert into reply_push_log (snippet_id, last_sent) values (new.snippet_id, now())
    on conflict (snippet_id) do update set last_sent = excluded.last_sent;
  select coalesce(nullif(display_name, ''), username, 'A friend') into name from profiles where id = new.user_id;
  perform send_push(owner, 'notify_replies', 'Snippets', name || ' replied to your moment.',
    jsonb_build_object('route', '/snippet/' || new.snippet_id));
  return new;
end $$;

drop trigger if exists comments_notify_reply on public.comments;
create trigger comments_notify_reply after insert on public.comments
  for each row execute function public.notify_reply();

-------------------------------------------------------------------------------
-- Moderation alerts: every new report pings a webhook (Slack/Discord-compatible body).
-------------------------------------------------------------------------------

create or replace function public.alert_new_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare url text;
begin
  select value into url from app_config where key = 'moderation_webhook_url';
  if url is null then return new; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object(
      'text', format('New Snippets report %s: %s (snippet %s, comment %s)', new.id, new.reason, new.snippet_id, new.comment_id),
      'content', format('New Snippets report %s: %s', new.id, new.reason)
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end $$;

drop trigger if exists reports_alert on public.reports;
create trigger reports_alert after insert on public.reports
  for each row execute function public.alert_new_report();

-------------------------------------------------------------------------------
-- Invite preview for the public landing page: only the inviter's display name.
-------------------------------------------------------------------------------

create or replace function public.invite_preview(code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('display_name', coalesce(nullif(p.display_name, ''), p.username))
  from user_private up join profiles p on p.id = up.user_id
  where up.invite_code = lower(code)
$$;
grant execute on function public.invite_preview(text) to anon, authenticated;

-------------------------------------------------------------------------------
-- First-party analytics. No third-party SDK, no content: event names + a few counts.
-------------------------------------------------------------------------------

create table if not exists public.app_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  name       text not null check (name in (
               'app_open', 'friends_viewed', 'invite_sent', 'invite_accepted',
               'recap_shared', 'archive_exported', 'moment_saved', 'week_shared')),
  props      jsonb not null default '{}'::jsonb check (pg_column_size(props) < 512),
  created_at timestamptz not null default now()
);
create index if not exists app_events_name_created on public.app_events (name, created_at);
alter table public.app_events enable row level security;
create policy "events insert own" on public.app_events
  for insert to authenticated with check (user_id = auth.uid());
-- No select policy: users can't read events, including their own. Only the service role can.

-- Metrics live in their own schema, which the public API doesn't expose.
create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

-- Weekly participation (§34): who saved anything, who shared on Sunday.
create or replace view analytics.weekly_participation as
select
  w.week_start,
  count(*) filter (where exists (select 1 from snippets s where s.user_id = w.user_id and s.week_start = w.week_start)) as users_with_moments,
  count(*) filter (where w.status = 'published') as users_shared,
  count(*) filter (where w.status = 'backfilled') as users_backfilled,
  (select count(*) from profiles p where p.created_at < w.week_start + 7) as accounts
from weeks w
group by w.week_start
order by w.week_start desc;

-- Friend groups sharing (§34): sharers with at least one friend who also shared that week.
create or replace view analytics.reciprocal_sharing as
select
  w.week_start,
  count(distinct w.user_id) as sharers,
  count(distinct w.user_id) filter (where exists (
    select 1 from friendships f
    join weeks w2 on w2.week_start = w.week_start and w2.status = 'published'
      and w2.user_id = case when f.requester_id = w.user_id then f.recipient_id else f.requester_id end
    where f.status = 'accepted' and (f.requester_id = w.user_id or f.recipient_id = w.user_id)
  )) as sharers_with_a_sharing_friend
from weeks w
where w.status = 'published'
group by w.week_start
order by w.week_start desc;

-- Cohort retention: of people who signed up in week N, what share shared k weeks later.
create or replace view analytics.cohort_retention as
with cohorts as (
  select id as user_id, (created_at::date - (extract(isodow from created_at)::int - 1)) as cohort_week
  from profiles
)
select
  c.cohort_week,
  ((w.week_start - c.cohort_week) / 7) as weeks_since_signup,
  count(distinct w.user_id) as shared,
  (select count(*) from cohorts c2 where c2.cohort_week = c.cohort_week) as cohort_size
from cohorts c
join weeks w on w.user_id = c.user_id and w.status = 'published'
group by c.cohort_week, weeks_since_signup
order by c.cohort_week desc, weeks_since_signup;

-- Archive depth (§34): how many weeks of history people are building.
create or replace view analytics.archive_depth as
select
  user_id,
  count(*) filter (where status in ('published', 'backfilled')) as weeks_kept,
  min(week_start) as first_week,
  max(week_start) as latest_week
from weeks
group by user_id;

-- Reciprocity (§34): after sharing, did they look at friends' weeks that week?
create or replace view analytics.view_after_share as
select
  w.week_start,
  count(*) as sharers,
  count(*) filter (where exists (
    select 1 from app_events e
    where e.user_id = w.user_id and e.name = 'friends_viewed'
      and e.created_at >= w.published_at and e.created_at < (w.week_start + 8)::timestamptz
  )) as viewed_friends_after
from weeks w
where w.status = 'published'
group by w.week_start
order by w.week_start desc;

revoke execute on function public.notify_reply(), public.alert_new_report() from public, anon, authenticated;
