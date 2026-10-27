-- Snippets — initial schema
-- Server is the source of truth for every non-negotiable rule:
--   * 3 snippets / week, 3 media / snippet, videos <= 15s
--   * publish only on Sunday (user's local timezone), for the current week
--   * post-to-unlock: a friend's week W is visible only if the viewer published W live
--   * backfilled weeks never unlock friends' weeks
--   * mutual friends only

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net;

-------------------------------------------------------------------------------
-- Profiles
-------------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique check (username = lower(username) and username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  avatar_path  text,
  created_at   timestamptz not null default now()
);

-- Owner-only data (never exposed to friends).
create table public.user_private (
  user_id              uuid primary key references public.profiles on delete cascade,
  timezone             text not null default 'UTC',
  invite_code          text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  notify_sunday        boolean not null default true,
  notify_nudges        boolean not null default true,
  notify_friend_posted boolean not null default true,
  last_sunday_reminder date
);

create table public.devices (
  token      text primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  platform   text,
  updated_at timestamptz not null default now()
);

-- Create profile rows when an auth user is created.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''));
  insert into public.user_private (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Time helpers (user-local week math)
-------------------------------------------------------------------------------

create or replace function public.user_today(uid uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from user_private where user_id = uid), 'UTC'))::date
$$;

create or replace function public.user_week_start(uid uuid) returns date
language sql stable as $$
  select public.user_today(uid) - (extract(isodow from public.user_today(uid))::int - 1)
$$;

create or replace function public.set_timezone(tz text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from pg_timezone_names where name = tz) then
    raise exception 'Unknown timezone %', tz;
  end if;
  update user_private set timezone = tz where user_id = auth.uid();
end $$;

-------------------------------------------------------------------------------
-- Friendships (mutual)
-------------------------------------------------------------------------------

create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  check (requester_id <> recipient_id)
);
create unique index friendships_pair on public.friendships
  (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index on public.friendships (recipient_id);

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and recipient_id = b) or (requester_id = b and recipient_id = a))
  )
$$;

create or replace function public.friend_ids(uid uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select case when requester_id = uid then recipient_id else requester_id end
  from friendships where status = 'accepted' and (requester_id = uid or recipient_id = uid)
$$;

create or replace function public.send_friend_request(target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare existing friendships;
begin
  if target = auth.uid() then raise exception 'That''s you'; end if;
  if is_blocked(auth.uid(), target) then raise exception 'You can''t add this person'; end if;
  select * into existing from friendships
    where least(requester_id, recipient_id) = least(auth.uid(), target)
      and greatest(requester_id, recipient_id) = greatest(auth.uid(), target);
  if existing.id is not null then
    -- They already asked us: accept.
    if existing.status = 'pending' and existing.recipient_id = auth.uid() then
      update friendships set status = 'accepted', accepted_at = now() where id = existing.id;
      return 'accepted';
    end if;
    return existing.status;
  end if;
  insert into friendships (requester_id, recipient_id) values (auth.uid(), target);
  return 'pending';
end $$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if accept then
    update friendships set status = 'accepted', accepted_at = now()
      where id = request_id and recipient_id = auth.uid() and status = 'pending';
  else
    delete from friendships where id = request_id and recipient_id = auth.uid() and status = 'pending';
  end if;
end $$;

create or replace function public.remove_friend(other uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships
  where (requester_id = auth.uid() and recipient_id = other)
     or (requester_id = other and recipient_id = auth.uid())
$$;

create or replace function public.accept_invite(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  select user_id into inviter from user_private where invite_code = lower(code);
  if inviter is null then raise exception 'This invite link isn''t valid anymore'; end if;
  if inviter = auth.uid() then return inviter; end if;
  if is_blocked(auth.uid(), inviter) then raise exception 'This invite link isn''t valid anymore'; end if;
  insert into friendships (requester_id, recipient_id, status, accepted_at)
    values (inviter, auth.uid(), 'accepted', now())
  on conflict ((least(requester_id, recipient_id)), (greatest(requester_id, recipient_id)))
    do update set status = 'accepted', accepted_at = coalesce(friendships.accepted_at, now());
  return inviter;
end $$;

create or replace function public.regenerate_invite_code() returns text
language sql security definer set search_path = public as $$
  update user_private set invite_code = encode(extensions.gen_random_bytes(6), 'hex')
  where user_id = auth.uid() returning invite_code
$$;

-------------------------------------------------------------------------------
-- Weeks, snippets, media
-------------------------------------------------------------------------------

create table public.weeks (
  user_id      uuid not null references public.profiles on delete cascade,
  week_start   date not null check (extract(isodow from week_start) = 1),
  -- draft: private; published: shared live on its Sunday; backfilled: added to archive later
  status       text not null default 'draft' check (status in ('draft', 'published', 'backfilled')),
  published_at timestamptz,
  primary key (user_id, week_start)
);

create table public.snippets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles on delete cascade,
  week_start  date not null,
  happened_on date not null,
  title       text not null default '' check (char_length(title) <= 80),
  reflection  text not null default '' check (char_length(reflection) <= 1000),
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (user_id, week_start) references public.weeks on delete cascade,
  check (happened_on between week_start and week_start + 6)
);
create index on public.snippets (user_id, week_start);
create index on public.snippets (week_start);

create table public.media (
  id          uuid primary key default gen_random_uuid(),
  snippet_id  uuid not null references public.snippets on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles on delete cascade,
  kind        text not null check (kind in ('image', 'video')),
  path        text not null,
  thumb_path  text,
  width       int not null default 0,
  height      int not null default 0,
  duration_ms int check (duration_ms is null or duration_ms <= 15500),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index on public.media (snippet_id);

create or replace function public.snippets_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if new.week_start > user_week_start(new.user_id) then
    raise exception 'You can''t add moments to a future week';
  end if;
  if new.happened_on > user_today(new.user_id) then
    raise exception 'That day hasn''t happened yet';
  end if;
  if tg_op = 'INSERT' then
    insert into weeks (user_id, week_start) values (new.user_id, new.week_start)
      on conflict do nothing;
    if (select count(*) from snippets where user_id = new.user_id and week_start = new.week_start) >= 3 then
      raise exception 'A week holds up to 3 moments';
    end if;
  elsif new.week_start <> old.week_start then
    raise exception 'A moment can''t move to a different week';
  end if;
  new.updated_at = now();
  return new;
end $$;

create trigger snippets_before_write before insert or update on public.snippets
  for each row execute function public.snippets_before_write();

create or replace function public.media_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from snippets where id = new.snippet_id and user_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  if (select count(*) from media where snippet_id = new.snippet_id) >= 3 then
    raise exception 'A moment holds up to 3 photos or videos';
  end if;
  if split_part(new.path, '/', 1) <> auth.uid()::text then
    raise exception 'Bad media path';
  end if;
  return new;
end $$;

create trigger media_before_insert before insert on public.media
  for each row execute function public.media_before_insert();

-- Sharing -------------------------------------------------------------------

create or replace function public.publish_week(wk date) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if wk <> user_week_start(uid) then raise exception 'Only this week can be shared'; end if;
  if extract(isodow from user_today(uid)) <> 7 then
    raise exception 'Sharing opens on Sunday';
  end if;
  if not exists (select 1 from snippets where user_id = uid and week_start = wk) then
    raise exception 'Add at least one moment first';
  end if;
  update weeks set status = 'published', published_at = now()
    where user_id = uid and week_start = wk and status = 'draft';
  perform notify_friends_posted(uid);
end $$;

-- Save a past week to the archive. Visible to friends who shared that week,
-- but never unlocks anyone else's week for the backfiller.
create or replace function public.backfill_week(wk date) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if wk >= user_week_start(uid) then raise exception 'Only past weeks can be backfilled'; end if;
  if not exists (select 1 from snippets where user_id = uid and week_start = wk) then
    raise exception 'Add at least one moment first';
  end if;
  update weeks set status = 'backfilled', published_at = now()
    where user_id = uid and week_start = wk and status = 'draft';
end $$;

-- Deleting the last moment of an unshared week drops the week row too.
create or replace function public.snippets_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from weeks w where w.user_id = old.user_id and w.week_start = old.week_start
    and w.status = 'draft'
    and not exists (select 1 from snippets s where s.user_id = old.user_id and s.week_start = old.week_start);
  return old;
end $$;

create trigger snippets_after_delete after delete on public.snippets
  for each row execute function public.snippets_after_delete();

-- Visibility ----------------------------------------------------------------

create or replace function public.can_view_week(owner uuid, wk date) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or (
    are_friends(auth.uid(), owner)
    and exists (select 1 from weeks where user_id = owner and week_start = wk
                and status in ('published', 'backfilled'))
    and exists (select 1 from weeks where user_id = auth.uid() and week_start = wk
                and status = 'published')
  )
$$;

create or replace function public.can_view_snippet(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from snippets s where s.id = sid and can_view_week(s.user_id, s.week_start))
$$;

-------------------------------------------------------------------------------
-- Reactions, comments, nudges
-------------------------------------------------------------------------------

create table public.reactions (
  snippet_id uuid not null references public.snippets on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  kind       text not null check (kind in ('heart', 'laugh', 'wow', 'thumbs')),
  created_at timestamptz not null default now(),
  primary key (snippet_id, user_id)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  snippet_id uuid not null references public.snippets on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on public.comments (snippet_id);

create table public.nudges (
  from_id    uuid not null references public.profiles on delete cascade,
  to_id      uuid not null references public.profiles on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, week_start)
);

-- What the Friends tab needs even while locked: who posted, how many, nudged?
create or replace function public.friends_week_status(wk date)
returns table (friend_id uuid, posted boolean, snippet_count int, nudged boolean, unlocked boolean)
language sql stable security definer set search_path = public as $$
  select f.id,
         coalesce(w.status = 'published', false),
         (select count(*)::int from snippets s where s.user_id = f.id and s.week_start = wk
            and w.status = 'published'),
         exists (select 1 from nudges n where n.from_id = auth.uid() and n.to_id = f.id and n.week_start = wk),
         can_view_week(f.id, wk)
  from friend_ids(auth.uid()) as f(id)
  left join weeks w on w.user_id = f.id and w.week_start = wk
$$;

create or replace function public.nudge(friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare wk date := user_week_start(friend);
begin
  if not are_friends(auth.uid(), friend) then raise exception 'Not friends'; end if;
  if exists (select 1 from weeks where user_id = friend and week_start = wk and status = 'published') then
    return; -- already shared
  end if;
  insert into nudges (from_id, to_id, week_start) values (auth.uid(), friend, wk)
    on conflict do nothing;
  if found then
    perform send_push(friend, 'notify_nudges', 'Snippets',
      'A friend nudged you to share your week.', jsonb_build_object('route', '/'));
  end if;
end $$;

-------------------------------------------------------------------------------
-- Safety: block + report (App Store Guideline 1.2)
-------------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  target_user_id uuid references public.profiles on delete set null,
  snippet_id     uuid references public.snippets on delete set null,
  comment_id     uuid references public.comments on delete set null,
  reason         text not null check (char_length(reason) between 1 and 500),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.block_user(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if target = auth.uid() then return; end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), target) on conflict do nothing;
  delete from friendships
    where (requester_id = auth.uid() and recipient_id = target) or (requester_id = target and recipient_id = auth.uid());
end $$;

-------------------------------------------------------------------------------
-- Push notifications (Expo push service via pg_net) — intentionally sparse
-------------------------------------------------------------------------------

create or replace function public.send_push(uid uuid, pref text, title text, body text, data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  enabled boolean;
  msgs jsonb;
begin
  execute format('select %I from user_private where user_id = $1', pref) into enabled using uid;
  if not coalesce(enabled, false) then return; end if;
  select jsonb_agg(jsonb_build_object('to', token, 'title', title, 'body', body, 'data', data, 'sound', 'default'))
    into msgs from devices where user_id = uid;
  if msgs is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := msgs,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
end $$;

create or replace function public.notify_friends_posted(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f uuid; name text;
begin
  select coalesce(nullif(display_name, ''), username) into name from profiles where id = uid;
  for f in select friend_ids(uid) loop
    perform send_push(f, 'notify_friend_posted', 'Snippets', name || ' shared their week.',
      jsonb_build_object('route', '/friends'));
  end loop;
end $$;

-- Hourly job: gentle Sunday reminder at 6pm local, only if there's something to share.
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
      perform send_push(r.user_id, 'notify_sunday', 'What was your week like?',
        'Your Snippets are ready to share.', jsonb_build_object('route', '/'));
    end if;
  end loop;
end $$;

-- Enable with pg_cron (Dashboard → Integrations → Cron), then:
--   select cron.schedule('sunday-reminders', '0 * * * *', 'select public.send_sunday_reminders()');

-------------------------------------------------------------------------------
-- Row level security
-------------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.user_private enable row level security;
alter table public.devices      enable row level security;
alter table public.friendships  enable row level security;
alter table public.weeks        enable row level security;
alter table public.snippets     enable row level security;
alter table public.media        enable row level security;
alter table public.reactions    enable row level security;
alter table public.comments     enable row level security;
alter table public.nudges       enable row level security;
alter table public.blocks       enable row level security;
alter table public.reports      enable row level security;

-- Profiles: signed-in users can find each other by username (no public web).
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "profiles self update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "private self read" on public.user_private
  for select to authenticated using (user_id = auth.uid());
create policy "private self update" on public.user_private
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "devices self" on public.devices
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "friendships parties read" on public.friendships
  for select to authenticated using (auth.uid() in (requester_id, recipient_id));

create policy "weeks visible" on public.weeks
  for select to authenticated using (can_view_week(user_id, week_start));

create policy "snippets visible" on public.snippets
  for select to authenticated using (can_view_week(user_id, week_start));
create policy "snippets owner insert" on public.snippets
  for insert to authenticated with check (user_id = auth.uid());
create policy "snippets owner update" on public.snippets
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "snippets owner delete" on public.snippets
  for delete to authenticated using (user_id = auth.uid());

create policy "media visible" on public.media
  for select to authenticated using (can_view_snippet(snippet_id));
create policy "media owner insert" on public.media
  for insert to authenticated with check (user_id = auth.uid());
create policy "media owner update" on public.media
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "media owner delete" on public.media
  for delete to authenticated using (user_id = auth.uid());

create policy "reactions visible" on public.reactions
  for select to authenticated using (can_view_snippet(snippet_id));
create policy "reactions own" on public.reactions
  for insert to authenticated with check (user_id = auth.uid() and can_view_snippet(snippet_id));
create policy "reactions own update" on public.reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reactions own delete" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

create policy "comments visible" on public.comments
  for select to authenticated using (
    can_view_snippet(snippet_id)
    and not exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = comments.user_id)
  );
create policy "comments own insert" on public.comments
  for insert to authenticated with check (user_id = auth.uid() and can_view_snippet(snippet_id));
-- Authors can delete their comments; snippet owners can remove comments on their snippets.
create policy "comments delete" on public.comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from snippets s where s.id = snippet_id and s.user_id = auth.uid())
  );

create policy "blocks own" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "blocks own delete" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());
create policy "reports own insert" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

create policy "nudges own read" on public.nudges
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());

-------------------------------------------------------------------------------
-- Storage: private buckets. Paths are "<user_id>/<snippet_id>/<file>".
-------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', false, 26214400, array['image/jpeg', 'image/png', 'image/heic', 'video/mp4', 'video/quicktime']),
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create or replace function public.can_view_media_object(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select split_part(object_name, '/', 1) = auth.uid()::text
      or exists (
        select 1 from media m
        where (m.path = object_name or m.thumb_path = object_name)
          and can_view_snippet(m.snippet_id)
      )
$$;

create policy "media objects owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('media', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media objects owner update" on storage.objects
  for update to authenticated
  using (bucket_id in ('media', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media objects owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('media', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media objects read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.can_view_media_object(name));
create policy "avatars read" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

-- Internal helpers are not part of the client API (they take arbitrary user ids).
revoke execute on function
  public.send_push(uuid, text, text, text, jsonb),
  public.notify_friends_posted(uuid),
  public.send_sunday_reminders(),
  public.handle_new_user(),
  public.friend_ids(uuid),
  public.are_friends(uuid, uuid),
  public.is_blocked(uuid, uuid),
  public.user_today(uuid),
  public.user_week_start(uuid)
from public, anon, authenticated;
