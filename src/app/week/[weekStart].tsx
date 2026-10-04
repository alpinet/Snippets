import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { BackBar } from '../../components/BackBar';
import { SnippetCard } from '../../components/social';
import { Card, ErrorNote, Loading, PrimaryButton, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { openEditor } from '../../lib/nav';
import { invalidateSnippets, useMe, useMyWeek } from '../../lib/queries';
import { currentWeekStart, formatWeekRange } from '../../lib/week';
import { colors, iconStroke, type } from '../../theme';

export default function MyWeek() {
  const { weekStart } = useLocalSearchParams<{ weekStart: string }>();
  const week = useMyWeek(weekStart);
  const me = useMe();
  const backfill = useMutation({ mutationFn: () => api.backfillWeek(weekStart), onSuccess: invalidateSnippets });

  const w = week.data;
  const n = w?.snippets.length ?? 0;
  const isPast = weekStart < currentWeekStart();
  const status =
    w?.status === 'published' ? 'Shared with friends on Sunday'
      : w?.status === 'backfilled' ? 'Saved to your archive'
        : n ? 'Not saved yet — only you can see this' : 'Nothing saved for this week yet';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackBar title={formatWeekRange(weekStart)} />
      <Screen contentStyle={{ paddingTop: 8 }}>
        {week.isLoading ? (
          <Loading />
        ) : week.isError ? (
          <ErrorNote error={week.error} onRetry={() => week.refetch()} />
        ) : (
          <>
            <Text style={[type.secondary, { marginBottom: 16 }]}>{status}</Text>
            <View style={{ gap: 16 }}>
              {w!.snippets.map((s) => (
                <SnippetCard key={s.id} snippet={s} meId={me.data?.id ?? ''} commentLimit={3} social={w!.status !== 'draft'} />
              ))}
            </View>
            {n < 3 ? (
              <Card dashed onPress={() => openEditor({ weekStart })} style={[styles.add, n ? { marginTop: 16 } : null]}>
                <Plus size={18} color={colors.accent} strokeWidth={iconStroke} />
                <Text style={styles.addText}>{n ? 'Add another moment' : 'Add a moment from this week'}</Text>
              </Card>
            ) : null}
            {isPast && w!.status === 'draft' && n ? (
              <>
                <PrimaryButton
                  title="Save to archive"
                  onPress={() => backfill.mutate()}
                  loading={backfill.isPending}
                  style={{ marginTop: 24 }}
                />
                <Text style={[type.small, { textAlign: 'center', marginTop: 10, color: colors.ink3 }]}>
                  Friends who shared this week will see it. Backfilling doesn’t open their past weeks.
                </Text>
              </>
            ) : null}
          </>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  add: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addText: { color: colors.accent, fontSize: 16, fontWeight: '500' },
});
