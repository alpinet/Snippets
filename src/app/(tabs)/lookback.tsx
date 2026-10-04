import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Shuffle } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { CalendarView } from '../../components/CalendarView';
import { MediaThumb } from '../../components/media';
import {
  Badge, Card, EmptyState, ErrorNote, Loading, PrimaryButton, Screen, ScreenHeader, TextButton,
} from '../../components/ui';
import { api, type Snippet, type Week } from '../../lib/api';
import { invalidateSnippets, useArchive, useMe } from '../../lib/queries';
import {
  addDays, currentWeekStart, formatLongDate, formatMonth, formatWeekRange, monthKey, today,
} from '../../lib/week';
import { colors, iconStroke, type } from '../../theme';

type Entry =
  | { kind: 'month'; key: string; label: string }
  | { kind: 'week'; key: string; week: Week }
  | { kind: 'missed'; key: string; weekStart: string }
  | { kind: 'lastMonth'; key: string; week: Week }
  | { kind: 'random'; key: string; snippet: Snippet };

export default function Lookback() {
  const archive = useArchive();
  const me = useMe();
  const [shuffle, setShuffle] = useState(0);
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');

  const past = useMemo(
    () => (archive.data ?? []).filter((w) => w.weekStart < currentWeekStart()),
    [archive.data],
  );

  const entries = useMemo(() => {
    const out: Entry[] = [];
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
        out.push({ kind: 'month', key: `m-${mk}`, label: formatMonth(ws) });
        lastMonthKey = mk;
      }
      const w = byWeek.get(ws);
      if (!w) {
        out.push({ kind: 'missed', key: `missed-${ws}`, weekStart: ws });
        continue;
      }
      out.push({ kind: 'week', key: ws, week: w });
      if (saved === 1 && lastMonth) out.push({ kind: 'lastMonth', key: 'last-month', week: lastMonth });
      if (saved === 3 && random) out.push({ kind: 'random', key: 'random', snippet: random });
      saved += 1;
    }
    if (past.length < 2 && lastMonth) out.push({ kind: 'lastMonth', key: 'last-month', week: lastMonth });
    if (past.length < 4 && random) out.push({ kind: 'random', key: 'random', snippet: random });
    return out;
  }, [past, shuffle]);

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
          <Segmented value={view} onChange={setView} />
          {view === 'calendar' ? (
            <CalendarView snippets={(archive.data ?? []).flatMap((w) => w.snippets)} />
          ) : (
          <View style={styles.timeline}>
            <View style={styles.rail} />
            {entries.map((e) => (
              <TimelineEntry key={e.key} entry={e} meId={me.data?.id ?? ''} onShuffle={() => setShuffle((n) => n + 1)} />
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

function TimelineEntry({ entry, meId, onShuffle }: { entry: Entry; meId: string; onShuffle: () => void }) {
  switch (entry.kind) {
    case 'month':
      return (
        <View style={[styles.row, { marginTop: 10, marginBottom: 8 }]}>
          <Text style={type.label}>{entry.label}</Text>
        </View>
      );
    case 'week':
      return (
        <Row>
          <WeekCard week={entry.week} meId={meId} />
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
            <WeekCard week={entry.week} meId={meId} showTitle={false} />
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
            <Card
              style={styles.randomCard}
              onPress={() => router.push({ pathname: '/snippet/[id]', params: { id: entry.snippet.id } })}
            >
              {entry.snippet.media[0] ? <MediaThumb item={entry.snippet.media[0]} style={styles.randomThumb} rounded={12} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={type.cardTitle} numberOfLines={2}>{entry.snippet.title || 'A moment'}</Text>
                <Text style={[type.small, { marginTop: 3 }]}>
                  {formatLongDate(entry.snippet.happenedOn)} · {entry.snippet.media.length}{' '}
                  {entry.snippet.media.length === 1 ? 'photo' : 'photos'}
                </Text>
              </View>
            </Card>
          </View>
        </Row>
      );
  }
}

function WeekCard({ week, meId, showTitle = true }: { week: Week; meId: string; showTitle?: boolean }) {
  const backfill = useMutation({ mutationFn: () => api.backfillWeek(week.weekStart), onSuccess: invalidateSnippets });
  const covers = week.snippets.map((s) => s.media[0]).filter(Boolean).slice(0, 3);
  const n = week.snippets.length;
  const replies = week.snippets.reduce((a, s) => a + s.comments.filter((c) => c.author.id !== meId).length, 0);
  const unshared = week.status === 'draft';

  return (
    <Card
      style={styles.weekCard}
      onPress={() => router.push({ pathname: '/week/[weekStart]', params: { weekStart: week.weekStart } })}
    >
      {showTitle ? <Text style={[type.cardTitle, { fontSize: 18, marginBottom: 10 }]}>{formatWeekRange(week.weekStart)}</Text> : null}
      <View style={styles.strip}>
        {covers.map((m) => (
          <MediaThumb key={m.id} item={m} style={styles.stripThumb} rounded={10} showPlay={false} />
        ))}
      </View>
      <View style={styles.meta}>
        <Text style={type.small}>
          {n} {n === 1 ? 'moment' : 'moments'}
          {unshared ? ' · not saved yet' : ` · ${replies} ${replies === 1 ? 'reply' : 'replies'}`}
        </Text>
        {unshared ? (
          <TextButton title="Save to archive" onPress={() => backfill.mutate()} disabled={backfill.isPending} style={{ fontSize: 14 }} />
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
});
