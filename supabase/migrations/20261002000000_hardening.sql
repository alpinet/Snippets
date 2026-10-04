-- Hardening: rate limits on write paths, stricter input validation, storage quotas, health check.
-- Limits are generous for real use and exist to stop scripted abuse.

-------------------------------------------------------------------------------
-- Input validation
-------------------------------------------------------------------------------

-- Whitespace-only text isn't content.
alter table public.comments add constraint comments_body_not_blank check (btrim(body) <> '');
alter table public.reports add constraint reports_reason_not_blank check (btrim(reason) <> '');
alter table public.profiles add constraint profiles_display_name_trimmed check (display_name = btrim(display_name));

-- Media paths must be "<owner>/<snippet>/<file>" for the snippet they're attached to.
create or replace function public.media_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from snippets where id = new.snippet_id and user_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  if (select count(*) from media where snippet_id = new.snippet_id) >= 3 then
    raise exception 'A moment holds up to 3 photos or videos';
  end if;
  if split_part(new.path, '/', 1) <> auth.uid()::text
     or split_part(new.path, '/', 2) <> new.snippet_id::text
     or (new.thumb_path is not null and split_part(new.thumb_path, '/', 2) <> new.snippet_id::text) then
    raise exception 'Bad media path';
  end if;
  if new.kind = 'video' and new.duration_ms is null then
    raise exception 'Videos need a duration';
  end if;
  return new;
end $$;

-------------------------------------------------------------------------------
-- Rate limits
-------------------------------------------------------------------------------

create index if not exists comments_user_created on public.comments (user_id, created_at);
create index if not exists reports_reporter_created on public.reports (reporter_id, created_at);
create index if not exists friendships_requester_created on public.friendships (requester_id, created_at);

create or replace function public.limit_comments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from comments where user_id = new.user_id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Slow down a little — try again in a few minutes';
  end if;
  return new;
end $$;
create trigger comments_rate_limit before insert on public.comments
  for each row execute function public.limit_comments();

create or replace function public.limit_reports() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You’ve sent a lot of reports today. We’ll review them soon.';
  end if;
  return new;
end $$;
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.limit_reports();

-- Friend requests (invite-link accepts are already 'accepted' and don't count).
create or replace function public.limit_friend_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and (
    select count(*) from friendships
    where requester_id = new.requester_id and created_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'That’s a lot of requests for one day — try again tomorrow';
  end if;
  return new;
end $$;
create trigger friendships_rate_limit before insert on public.friendships
  for each row execute function public.limit_friend_requests();

-------------------------------------------------------------------------------
-- Storage quotas: uploads only into a snippet you own, and only a handful of files per folder.
-- (Otherwise a client could upload unlimited files to its own folder without any media rows.)
-------------------------------------------------------------------------------

create or replace function public.can_upload_object(bucket text, object_name text) returns boolean
language plpgsql stable security definer set search_path = public, storage as $$
declare
  parts text[] := storage.foldername(object_name);
begin
  if parts[1] is distinct from auth.uid()::text then return false; end if;
  if bucket = 'avatars' then
    return (select count(*) from storage.objects o
            where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = auth.uid()::text) < 3;
  end if;
  if bucket = 'media' then
    return exists (select 1 from snippets s where s.id::text = parts[2] and s.user_id = auth.uid())
       and (select count(*) from storage.objects o
            where o.bucket_id = 'media' and (storage.foldername(o.name))[2] = parts[2]) < 6; -- 3 files + 3 thumbs
  end if;
  return false;
end $$;

drop policy if exists "media objects owner write" on storage.objects;
create policy "media objects owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('media', 'avatars') and public.can_upload_object(bucket_id, name));

-------------------------------------------------------------------------------
-- Health check: GET /rest/v1/rpc/health (anon key) or the `health` edge function.
-------------------------------------------------------------------------------

create or replace function public.health() returns jsonb
language sql stable as $$
  select jsonb_build_object('ok', true, 'db_time', now())
$$;
grant execute on function public.health() to anon, authenticated;
