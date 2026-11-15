-- Lookback as the heart of the app (docs/REFLECTION_PLAN.md, Phase 3).
--   * Moments can optionally be marked with a kind (small joy, first time, …) so Lookback can
--     gather threads like "Your firsts this year". The kind travels with the moment: friends see
--     it only on moments shared with them.
--   * "Looking back" notes: dated notes you add to a past moment later. Owner-only, always,
--     even on shared moments.
--   * One private weekly line, answered when you keep your week. Owner-only.
--   * One moment picked per month ("Which moment stood out this month?"). Owner-only.
-- No counts, scores or streaks are stored anywhere.

alter table public.snippets add column kind text
  check (kind in ('small_joy', 'first_time', 'proud_of', 'hard_but_worth_it', 'people'));

-- Looking-back notes ---------------------------------------------------------

create table public.lookback_notes (
  id          uuid primary key default gen_random_uuid(),
  snippet_id  uuid not null references public.snippets on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles on delete cascade,
  body        text not null check (char_length(body) <= 1000),
  -- The writer's local day ("A year later…"); the client sends it, like happened_on.
  written_on  date not null default current_date,
  created_at  timestamptz not null default now(),
  constraint lookback_notes_body_not_blank check (btrim(body) <> '')
);
create index on public.lookback_notes (snippet_id);
create index on public.lookback_notes (user_id);

alter table public.lookback_notes enable row level security;
create policy "lookback notes owner read" on public.lookback_notes
  for select to authenticated using (user_id = auth.uid());
-- Only on your own moments.
create policy "lookback notes owner insert" on public.lookback_notes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.snippets s where s.id = snippet_id and s.user_id = auth.uid())
  );
create policy "lookback notes owner delete" on public.lookback_notes
  for delete to authenticated using (user_id = auth.uid());

-- One line per week ----------------------------------------------------------

create table public.week_lines (
  user_id     uuid not null default auth.uid() references public.profiles on delete cascade,
  week_start  date not null,
  line        text not null check (char_length(line) <= 140),
  updated_at  timestamptz not null default now(),
  primary key (user_id, week_start),
  foreign key (user_id, week_start) references public.weeks on delete cascade,
  constraint week_lines_not_blank check (btrim(line) <> '')
);

alter table public.week_lines enable row level security;
create policy "week lines owner read" on public.week_lines
  for select to authenticated using (user_id = auth.uid());
create policy "week lines owner insert" on public.week_lines
  for insert to authenticated with check (user_id = auth.uid());
create policy "week lines owner update" on public.week_lines
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "week lines owner delete" on public.week_lines
  for delete to authenticated using (user_id = auth.uid());

-- The moment that stood out each month ----------------------------------------

create table public.month_picks (
  user_id     uuid not null default auth.uid() references public.profiles on delete cascade,
  month       date not null check (extract(day from month) = 1),
  snippet_id  uuid not null references public.snippets on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.month_picks enable row level security;
create policy "month picks owner read" on public.month_picks
  for select to authenticated using (user_id = auth.uid());
-- Your own moment, from that month.
create policy "month picks owner insert" on public.month_picks
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.snippets s where s.id = snippet_id and s.user_id = auth.uid()
                and date_trunc('month', s.happened_on)::date = month)
  );
create policy "month picks owner update" on public.month_picks
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.snippets s where s.id = snippet_id and s.user_id = auth.uid()
                and date_trunc('month', s.happened_on)::date = month)
  );
create policy "month picks owner delete" on public.month_picks
  for delete to authenticated using (user_id = auth.uid());
