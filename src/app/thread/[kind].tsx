import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackBar } from '../../components/BackBar';
import { MediaThumb } from '../../components/media';
import { Card, EmptyState, ErrorNote, Loading, Screen } from '../../components/ui';
import { MOMENT_KINDS, isMomentKind } from '../../lib/api';
import { useArchive } from '../../lib/queries';
import { formatLongDate, parseISODate, today } from '../../lib/week';
import { colors, type } from '../../theme';

/** Every moment of one kind ("Your firsts"), newest first, by year. A thread to read, not a tally. */
export default function ThreadScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const archive = useArchive();
  const meta = MOMENT_KINDS.find((m) => m.kind === kind);
  const thisYear = parseISODate(today()).getFullYear();

  const years = useMemo(() => {
    if (!isMomentKind(kind)) return [];
    const moments = (archive.data ?? [])
      .flatMap((w) => w.snippets)
      .filter((s) => s.kind === kind)
      .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn));
    const out: { year: number; snippets: typeof moments }[] = [];
    for (const s of moments) {
      const y = parseISODate(s.happenedOn).getFullYear();
      if (out[out.length - 1]?.year !== y) out.push({ year: y, snippets: [] });
      out[out.length - 1].snippets.push(s);
    }
    return out;
  }, [archive.data, kind]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackBar title={meta?.thread} />
      <Screen contentStyle={{ paddingTop: 8 }}>
        {archive.isLoading ? (
          <Loading />
        ) : archive.isError ? (
          <ErrorNote error={archive.error} onRetry={() => archive.refetch()} />
        ) : !years.length ? (
          <EmptyState title="Nothing here yet" body="Mark a moment with this kind and it will gather here." />
        ) : (
          years.map(({ year, snippets }) => (
            <View key={year} style={{ marginBottom: 18 }}>
              <Text style={[type.label, { marginBottom: 10 }]}>{year === thisYear ? 'This year' : String(year)}</Text>
              <View style={{ gap: 10 }}>
                {snippets.map((s) => (
                  <Card
                    key={s.id}
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/snippet/[id]', params: { id: s.id } })}
                  >
                    {s.media[0] ? <MediaThumb item={s.media[0]} style={styles.thumb} rounded={12} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={type.cardTitle} numberOfLines={2}>{s.title || 'A moment'}</Text>
                      <Text style={[type.small, { marginTop: 2 }]}>{formatLongDate(s.happenedOn)}</Text>
                      {s.reflection ? (
                        <Text style={[type.reflection, styles.reflection]} numberOfLines={2}>{s.reflection}</Text>
                      ) : null}
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  thumb: { width: 64, height: 64 },
  reflection: { fontSize: 15, lineHeight: 21, color: colors.ink2, marginTop: 4 },
});
