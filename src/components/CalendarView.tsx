import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Snippet } from '../lib/api';
import {
  addDays, dayIndex, formatMonth, parseISODate, toISODate, today, weekStartOf, type ISODate,
} from '../lib/week';
import { colors, gutter, type } from '../theme';
import { openEditor } from '../lib/nav';
import { MediaThumb } from './media';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const GAP = 6;

/** Month grids with a photo on every day you kept a moment. Newest month first. */
export function CalendarView({ snippets }: { snippets: Snippet[] }) {
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - gutter * 2 - GAP * 6) / 7);

  const byDay = useMemo(() => {
    const m = new Map<ISODate, Snippet[]>();
    for (const s of snippets) m.set(s.happenedOn, [...(m.get(s.happenedOn) ?? []), s]);
    return m;
  }, [snippets]);

  // From this month back to the earliest month with a moment (at least 3 months).
  const months = useMemo(() => {
    const t = parseISODate(today());
    const earliest = snippets.reduce((min, s) => (s.happenedOn < min ? s.happenedOn : min), today());
    const out: ISODate[] = [];
    const cur = new Date(t.getFullYear(), t.getMonth(), 1);
    while (out.length < 3 || toISODate(cur) >= earliest.slice(0, 8) + '01') {
      out.push(toISODate(cur));
      cur.setMonth(cur.getMonth() - 1);
      if (out.length > 60) break;
    }
    return out;
  }, [snippets]);

  return (
    <View style={{ gap: 28 }}>
      {months.map((first) => (
        <Month key={first} first={first} cell={cell} byDay={byDay} />
      ))}
    </View>
  );
}

function Month({ first, cell, byDay }: { first: ISODate; cell: number; byDay: Map<ISODate, Snippet[]> }) {
  const t = today();
  const d = parseISODate(first);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const lead = dayIndex(first);
  const cells: (ISODate | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  const count = cells.reduce((n, day) => n + (day ? byDay.get(day)?.length ?? 0 : 0), 0);

  return (
    <View>
      <View style={styles.monthHeader}>
        <Text style={[type.cardTitle, { fontSize: 18 }]}>{formatMonth(first)}</Text>
        {count ? (
          <Text style={[type.small, { color: colors.accent }]}>{count} {count === 1 ? 'moment' : 'moments'}</Text>
        ) : (
          <Text style={type.small}>Nothing kept yet</Text>
        )}
      </View>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={[styles.weekday, { width: cell }]}>{w}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={{ width: cell, height: cell }} />;
          const moments = byDay.get(day);
          const future = day > t;
          const num = Number(day.slice(8));
          if (moments?.length) {
            const cover = moments[0].media[0];
            return (
              <Pressable
                key={day}
                style={({ pressed }) => [{ width: cell, height: cell }, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  moments.length === 1
                    ? router.push({ pathname: '/snippet/[id]', params: { id: moments[0].id } })
                    : router.push({ pathname: '/week/[weekStart]', params: { weekStart: weekStartOf(day) } })
                }
                accessibilityLabel={`${moments.length} moment${moments.length > 1 ? 's' : ''} on ${day}`}
              >
                {cover ? <MediaThumb item={cover} style={{ flex: 1 }} rounded={10} showPlay={false} /> : null}
                <View style={styles.photoShade} />
                <Text style={styles.photoNum}>{num}</Text>
                {moments.length > 1 ? <View style={styles.multi}><Text style={styles.multiText}>{moments.length}</Text></View> : null}
              </Pressable>
            );
          }
          // Empty past days are tappable: add (or backfill) a moment for that day.
          return (
            <Pressable
              key={day}
              disabled={future}
              onPress={() => openEditor({ weekStart: weekStartOf(day), day })}
              accessibilityLabel={`Add a moment on ${day}`}
              style={({ pressed }) => [
                styles.day, { width: cell, height: cell }, day === t && styles.today, pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.dayNum, future && { color: colors.hairlineStrong }, day === t && { color: colors.accent }]}>
                {num}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', gap: GAP, marginBottom: 6 },
  weekday: { fontSize: 11, fontWeight: '500', color: colors.ink3, textAlign: 'center' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  day: { borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.25, borderColor: colors.accent },
  dayNum: { fontSize: 14, color: colors.ink3 },
  photoShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10, backgroundColor: 'rgba(30, 20, 15, 0.18)' },
  photoNum: {
    position: 'absolute', top: 4, left: 6, fontSize: 13, fontWeight: '600', color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  multi: {
    position: 'absolute', bottom: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  multiText: { fontSize: 10, fontWeight: '600', color: colors.ink },
});
