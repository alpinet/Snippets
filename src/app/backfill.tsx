import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackBar } from '../components/BackBar';
import { Card, Hairline, Loading, Screen } from '../components/ui';
import { useArchive } from '../lib/queries';
import { addDays, currentWeekStart, formatMonth, formatWeekRange, monthKey } from '../lib/week';
import { colors, iconStroke, type } from '../theme';

const WEEKS_BACK = 52;

export default function Backfill() {
  const archive = useArchive();
  const byWeek = new Map((archive.data ?? []).map((w) => [w.weekStart, w]));
  const weeks = Array.from({ length: WEEKS_BACK }, (_, i) => addDays(currentWeekStart(), -7 * (i + 1)));
  const months: { key: string; label: string; weeks: string[] }[] = [];
  for (const w of weeks) {
    const k = monthKey(w);
    if (months[months.length - 1]?.key !== k) months.push({ key: k, label: formatMonth(w), weeks: [] });
    months[months.length - 1].weeks.push(w);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackBar title="Backfill a week" />
      <Screen contentStyle={{ paddingTop: 8 }}>
        <Text style={[type.secondary, { marginBottom: 20 }]}>
          Missed a week? Add a few moments from it to your archive, using photos from then.
        </Text>
        {archive.isLoading ? (
          <Loading />
        ) : (
          months.map((m) => (
            <View key={m.key} style={{ marginBottom: 20 }}>
              <Text style={[type.label, { marginBottom: 8 }]}>{m.label}</Text>
              <Card style={{ paddingHorizontal: 16 }}>
                {m.weeks.map((w, i) => {
                  const saved = byWeek.get(w);
                  const n = saved?.snippets.length ?? 0;
                  return (
                    <View key={w}>
                      {i > 0 ? <Hairline /> : null}
                      <Pressable
                        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                        onPress={() => router.push({ pathname: '/week/[weekStart]', params: { weekStart: w } })}
                      >
                        <Text style={[type.body, { flex: 1, fontSize: 16 }]}>{formatWeekRange(w)}</Text>
                        <Text style={[type.small, n === 0 && { color: colors.accent }]}>
                          {n === 0 ? 'Backfill' : `${n} ${n === 1 ? 'moment' : 'moments'}`}
                        </Text>
                        <ChevronRight size={18} color={colors.ink3} strokeWidth={iconStroke} />
                      </Pressable>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50 },
});
