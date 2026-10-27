import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, Shuffle } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarView } from '../../components/CalendarView';
import { MediaThumb } from '../../components/media';
import {
  Badge, Card, EmptyState, ErrorNote, Loading, PrimaryButton, Screen, ScreenHeader, TextButton,
} from '../../components/ui';
import { api, kindLabel, type MonthPicks, type Snippet, type Week } from '../../lib/api';
import { aroundLastYear, monthToPick, threadsForYear, type Thread } from '../../lib/lookback';
import { invalidateSnippets, useArchive, useMonthPicks, usePickMonth } from '../../lib/queries';
import {
  addDays, currentWeekStart, formatLongDate, formatMonth, formatWeekRange, monthKey, monthName, parseISODate, today,
} from '../../lib/week';
import { colors, gutter, iconStroke, type } from '../../theme';

type Entry =
  | { kind: 'month'; key: string; label: string; pick?: Snippet }
  | { kind: 'week'; key: string; week: Week }
  | { kind: 'missed'; key: string; weekStart: string }
  | { kind: 'lastMonth'; key: string; week: Week }
  | { kind: 'random'; key: string; snippet: Snippet }
  | { kind: 'lastYear'; key: string; snippet: Snippet };

export default function Lookback() {
  const archive = useArchive();
  const picks = useMonthPicks();
  const [shuffle, setShuffle] = useState(0);
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');

  const past = useMemo(
    () => (archive.data ?? []).filter((w) => w.weekStart < currentWeekStart()),
    [archive.data],
  );

  const all = useMemo(() => (archive.data ?? []).flatMap((w) => w.snippets), [archive.data]);
  const threads = useMemo(() => threadsForYear(all, parseISODate(today()).getFullYear()), [all]);
  const toPick = useMemo(() => monthToPick(all, picks.data ?? {}, today()), [all, picks.data]);

  const entries = useMemo(() => {
    const out: Entry[] = [];
    const byId = new Map(past.flatMap((w) => w.snippets).map((s) => [s.id, s]));
    const pickOf = (mk: string) => byId.get((picks.data ?? ({} as MonthPicks))[mk] ?? '');
    const lastYear = aroundLastYear(past.flatMap((w) => w.snippets), today());
    // "Around this time last month": the saved week nearest to four weeks ago (within a week).
    const target = addDays(today(), -28);
    const lastMonth = past
      .filter((w) => Math.abs(daysBetween(w.weekStart, target)) <= 10 && w.weekStart <= target)
      .sort((a, b) => Math.abs(daysBetween(a.weekStart, target)) - Math.abs(daysBetween(b.weekStart, target)))[0];

    const pool = past.flatMap((w) => w.snippets).filter((s) => s.weekStart < addDays(currentWeekStart(), -14));
    const random = pool.length ? pool[(hash(shuffle) + pool.length) % pool.length] : undefined;

    // Walk every week from last week back to your first saved one, so missed weeks
    // appear in place with a way to backfill them (§15).
    const byWeek = new Map(past.map((w) => [w.weekStart, w]));
    const earliest = past.length ? past[past.length - 1].weekStart : null;
    let lastMonthKey = '';
    let saved = 0;
    for (let ws = addDays(currentWeekStart(), -7); earliest && ws >= earliest; ws = addDays(ws, -7)) {
      const mk = monthKey(ws);
      if (mk !== lastMonthKey) {
        out.push({ kind: 'month', key: `m-${mk}`, label: formatMonth(ws), pick: pickOf(mk) });
        lastMonthKey = mk;
      }
      const w = byWeek.get(ws);
      if (!w) {
        out.push({ kind: 'missed', key: `missed-${ws}`, weekStart: ws });
        continue;
      }
      out.push({ kind: 'week', key: ws, week: w });
      if (saved === 0 && lastYear) out.push({ kind: 'lastYear', key: 'last-year', snippet: lastYear });
      if (saved === 1 && lastMonth) out.push({ kind: 'lastMonth', key: 'last-month', week: lastMonth });
      if (saved === 3 && random) out.push({ kind: 'random', key: 'random', snippet: random });
      saved += 1;
    }
    if (past.length < 2 && lastMonth) out.push({ kind: 'lastMonth', key: 'last-month', week: lastMonth });
    if (past.length < 4 && random) out.push({ kind: 'random', key: 'random', snippet: random });
    return out;
  }, [past, shuffle, picks.data]);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={archive.isRefetching} onRefresh={() => archive.refetch()} tintColor={colors.ink3} />}
    >
      <ScreenHeader title="Lookback" subline="Your weeks so far" />

      {archive.isLoading ? (
        <Loading />
      ) : archive.isError ? (
        <ErrorNote error={archive.error} onRetry={() => archive.refetch()} />
      ) : past.length === 0 ? (
        <EmptyState
          title="Your weeks will collect here"
          body="Every week you save becomes part of your scrapbook. Missed one? You can add it anytime."
          action={<PrimaryButton title="Backfill a week" onPress={() => router.push('/backfill')} />}
        />
      ) : (
        <>
          {toPick ? <MonthPickCard month={toPick.month} snippets={toPick.snippets} /> : null}
          {threads.length ? <Threads threads={threads} /> : null}
          <Segmented value={view} onChange={setView} />
          {view === 'calendar' ? (
            <CalendarView snippets={all} />
          ) : (
          <View style={styles.timeline}>
            <View style={styles.rail} />
            {entries.map((e) => (
              <TimelineEntry key={e.key} entry={e} onShuffle={() => setShuffle((n) => n + 1)} />
            ))}
          </View>
          )}
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <TextButton title="Backfill a missed week" onPress={() => router.push('/backfill')} />
          </View>
        </>
      )}
    </Screen>
  );
}

function daysBetween(a: string, b: string) {
  return (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}
function hash(n: number) {
  // Stable per shuffle press, different per day so it feels fresh.
  const seed = Number(today().replace(/-/g, '')) + n * 7919;
  return Math.abs((seed * 2654435761) % 2 ** 31);
}

function Row({ dot = true, children }: { dot?: boolean; children: ReactNode }) {
  return (
    <View style={styles.row}>
      {dot ? <View style={styles.dot} /> : null}
      {children}
    </View>
  );
}

const openMoment = (id: string, note = false) =>
  router.push({ pathname: '/snippet/[id]', params: note ? { id, note: '1' } : { id } });

function TimelineEntry({ entry, onShuffle }: { entry: Entry; onShuffle: () => void }) {
  switch (entry.kind) {
    case 'month':
      return (
        <View style={[styles.row, { marginTop: 10, marginBottom: 8 }]}>
          <Text style={type.label}>{entry.label}</Text>
          {entry.pick ? (
            <Pressable onPress={() => openMoment(entry.pick!.id)} hitSlop={6}>
              <Text style={[type.small, { marginTop: 3 }]} numberOfLines={1}>
                Stood out: <Text style={{ color: colors.ink }}>{entry.pick.title || 'a moment'}</Text>
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    case 'week':
      return (
        <Row>
          <WeekCard week={entry.week} />
        </Row>
      );
    case 'missed':
      return (
        <Row>
          <Pressable
            onPress={() => router.push({ pathname: '/week/[weekStart]', params: { weekStart: entry.weekStart } })}
            style={({ pressed }) => [styles.missed, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.body, { flex: 1, color: colors.ink2 }]}>{formatWeekRange(entry.weekStart)}</Text>
            <Text style={type.small}>Nothing saved ·</Text>
            <Text style={[type.small, { color: colors.accent, fontWeight: '500' }]}>Backfill</Text>
          </Pressable>
        </Row>
      );
    case 'lastMonth':
      return (
        <Row>
          <View style={{ gap: 8, flex: 1 }}>
            <Badge label="Around this time last month" />
            <WeekCard week={entry.week} showTitle={false} />
            {entry.week.snippets[0] ? <NoticePrompt snippetId={entry.week.snippets[0].id} /> : null}
          </View>
        </Row>
      );
    case 'lastYear':
      return (
        <Row>
          <View style={{ gap: 8, flex: 1 }}>
            <Badge label="Around this time last year" />
            <ResurfacedMoment snippet={entry.snippet} />
          </View>
        </Row>
      );
    case 'random':
      return (
        <Row>
          <View style={{ gap: 8, flex: 1 }}>
            <Badge
              label="Random memory"
              variant="outline"
              onPress={onShuffle}
              icon={<Shuffle size={14} color={colors.accent} strokeWidth={iconStroke} />}
            />
            <ResurfacedMoment snippet={entry.snippet} />
          </View>
        </Row>
      );
  }
}

/** Resurfacing asks a question instead of only showing photos. */
function NoticePrompt({ snippetId }: { snippetId: string }) {
  return (
    <View style={styles.notice}>
      <Text style={[type.reflection, { fontSize: 15, lineHeight: 21, color: colors.ink2, flex: 1 }]}>
        Looking back, what do you notice?
      </Text>
      <TextButton title="Add a note" onPress={() => openMoment(snippetId, true)} style={{ fontSize: 14 }} />
    </View>
  );
}

function ResurfacedMoment({ snippet }: { snippet: Snippet }) {
  const latest = snippet.notes[snippet.notes.length - 1];
  const kind = kindLabel(snippet.kind);
  return (
    <>
      <Card style={styles.randomCard} onPress={() => openMoment(snippet.id)}>
        {snippet.media[0] ? <MediaThumb item={snippet.media[0]} style={styles.randomThumb} rounded={12} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={type.cardTitle} numberOfLines={2}>{snippet.title || 'A moment'}</Text>
          <Text style={[type.small, { marginTop: 3 }]}>
            {formatLongDate(snippet.happenedOn)}
            {kind ? ` · ${kind}` : ''}
          </Text>
          {latest ? (
            <Text style={[type.reflection, { fontSize: 15, lineHeight: 21, color: colors.ink2, marginTop: 6 }]} numberOfLines={2}>
              “{latest.body}”
            </Text>
          ) : null}
        </View>
      </Card>
      <NoticePrompt snippetId={snippet.id} />
    </>
  );
}

/** "Your firsts this year": one card per kind you've used. Never a number to beat. */
function Threads({ threads }: { threads: Thread[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.threads} contentContainerStyle={{ gap: 10, paddingHorizontal: gutter }}>
      {threads.map((t) => (
        <Card
          key={t.kind}
          style={styles.thread}
          onPress={() => router.push({ pathname: '/thread/[kind]', params: { kind: t.kind } })}
        >
          <View style={styles.threadThumbs}>
            {t.snippets.slice(0, 3).map((s) =>
              s.media[0] ? <MediaThumb key={s.id} item={s.media[0]} style={styles.threadThumb} rounded={8} showPlay={false} /> : null,
            )}
          </View>
          <Text style={[type.cardTitle, { fontSize: 15, marginTop: 10 }]} numberOfLines={2}>{t.title}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

/** "Which moment stood out this month?" Pick one, or let it pass. */
function MonthPickCard({ month, snippets }: { month: string; snippets: Snippet[] }) {
  const pick = usePickMonth();
  const [chosen, setChosen] = useState<string | null>(null);
  const isThisMonth = month === monthKey(today());
  return (
    <Card style={styles.monthPick}>
      <Text style={type.prompt}>
        Which moment stood out {isThisMonth ? 'this month' : `in ${monthName(`${month}-01`)}`}?
      </Text>
      <Text style={[type.secondary, { marginTop: 2 }]}>Pick one to remember the month by.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 14 }}>
        {snippets.map((s) => {
          const selected = chosen === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setChosen(selected ? null : s.id)}
              style={{ width: 92 }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={s.title || formatLongDate(s.happenedOn)}
            >
              <View style={[styles.pickThumb, selected && styles.pickThumbOn]}>
                {s.media[0] ? <MediaThumb item={s.media[0]} style={{ width: 86, height: 86 }} rounded={10} showPlay={false} /> : null}
                {selected ? (
                  <View style={styles.pickCheck}>
                    <Check size={14} color={colors.accentInk} strokeWidth={2.5} />
                  </View>
                ) : null}
              </View>
              <Text style={[type.small, { marginTop: 6, color: colors.ink }]} numberOfLines={2}>{s.title || 'A moment'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <TextButton
          title="This one"
          disabled={!chosen || pick.isPending}
          onPress={() => chosen && pick.mutate({ month, snippetId: chosen })}
        />
      </View>
    </Card>
  );
}

function WeekCard({ week, showTitle = true }: { week: Week; showTitle?: boolean }) {
  const backfill = useMutation({ mutationFn: () => api.backfillWeek(week.weekStart), onSuccess: invalidateSnippets });
  const covers = week.snippets.map((s) => s.media[0]).filter(Boolean).slice(0, 3);
  const n = week.snippets.length;
  // Your archive counts your moments, never other people's replies.
  const justForMe = week.snippets.filter((s) => s.visibility === 'private').length;
  const unshared = week.status === 'draft';

  return (
    <Card
      style={styles.weekCard}
      onPress={() => router.push({ pathname: '/week/[weekStart]', params: { weekStart: week.weekStart } })}
    >
      {showTitle ? <Text style={[type.cardTitle, { fontSize: 18, marginBottom: 10 }]}>{formatWeekRange(week.weekStart)}</Text> : null}
      {week.line ? (
        <Text style={[type.reflection, { fontSize: 16, lineHeight: 23, marginBottom: 10 }]}>“{week.line}”</Text>
      ) : null}
      <View style={styles.strip}>
        {covers.map((m) => (
          <MediaThumb key={m.id} item={m} style={styles.stripThumb} rounded={10} showPlay={false} />
        ))}
      </View>
      <View style={styles.meta}>
        <Text style={type.small}>
          {n} {n === 1 ? 'moment' : 'moments'}
          {unshared ? ' · not kept yet' : justForMe ? ` · ${justForMe === n ? 'all' : justForMe} just for you` : ''}
        </Text>
        {unshared ? (
          <TextButton title="Keep this week" onPress={() => backfill.mutate()} disabled={backfill.isPending} style={{ fontSize: 14 }} />
        ) : null}
      </View>
    </Card>
  );
}

function Segmented({ value, onChange }: { value: 'timeline' | 'calendar'; onChange: (v: 'timeline' | 'calendar') => void }) {
  return (
    <View style={styles.segmented}>
      {(['timeline', 'calendar'] as const).map((v) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          style={[styles.segment, value === v && styles.segmentOn]}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === v }}
        >
          <Text style={[styles.segmentText, value === v && { color: colors.ink }]}>
            {v === 'timeline' ? 'Timeline' : 'Calendar'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const RAIL_X = 6;

const styles = StyleSheet.create({
  timeline: { position: 'relative', paddingLeft: 26 },
  rail: {
    position: 'absolute',
    left: RAIL_X,
    top: 8,
    bottom: 8,
    width: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(120, 100, 88, 0.35)',
  },
  row: { marginBottom: 14, position: 'relative' },
  dot: {
    position: 'absolute',
    left: -26 + RAIL_X - 3.25,
    top: 22,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(120, 100, 88, 0.55)',
  },
  weekCard: { padding: 16 },
  missed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineStrong,
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: 12, padding: 3, marginBottom: 20 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  segmentOn: {
    backgroundColor: colors.card,
    shadowColor: '#5A4030', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '500', color: colors.ink2 },
  strip: { flexDirection: 'row', gap: 10 },
  stripThumb: { width: 84, height: 84 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  randomCard: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  randomThumb: { width: 72, height: 72 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  threads: { marginBottom: 20, marginHorizontal: -gutter },
  thread: { width: 160, padding: 12 },
  threadThumbs: { flexDirection: 'row', gap: 4 },
  threadThumb: { width: 42, height: 42 },
  monthPick: { padding: 18, marginBottom: 20 },
  pickThumb: { width: 92, height: 92, borderRadius: 13, padding: 3, borderWidth: 1.5, borderColor: 'transparent' },
  pickThumbOn: { borderColor: colors.accent },
  pickCheck: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
