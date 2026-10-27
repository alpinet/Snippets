import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Lock, Plus, Sparkles, Users } from 'lucide-react-native';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { GettingStartedCard, LastWeekCard } from '../../components/HomeCards';
import { MediaThumb } from '../../components/media';
import { Card, ErrorNote, Loading, PrimaryButton, Screen, ScreenHeader } from '../../components/ui';
import { api, type Snippet } from '../../lib/api';
import { track } from '../../lib/analytics';
import { openEditor } from '../../lib/nav';
import { invalidateSnippets, useMyWeek } from '../../lib/queries';
import { useOnline } from '../../lib/useOnline';
import { useTick } from '../../lib/useTick';
import {
  DAY_SHORT, currentWeekStart, formatWeekRange, isSunday, today, weekDays, type ISODate,
} from '../../lib/week';
import { colors, iconStroke, type } from '../../theme';

const MAX = 3;

export default function Home() {
  useTick(30_000);
  const wk = currentWeekStart();
  const t = today();
  const sunday = isSunday();
  const week = useMyWeek(wk);
  const online = useOnline();

  const publish = useMutation({
    mutationFn: () => api.publishWeek(wk),
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      track('week_kept', { moments: count, shared: sharedCount });
      await invalidateSnippets();
    },
  });

  const snippets = week.data?.snippets ?? [];
  const count = snippets.length;
  const sharedCount = snippets.filter((s) => s.visibility === 'friends').length;
  const published = week.data?.status === 'published';
  const canAdd = count < MAX;

  const confirmKeep = () =>
    Alert.alert(
      'Keep your week?',
      [
        `${count === 1 ? 'Your moment goes' : `Your ${count} moments go`} into your Lookback.`,
        sharedCount === 0
          ? 'All of it is just for you.'
          : `${sharedCount === count ? (count === 1 ? 'It’s' : 'All are') : `${sharedCount} of ${count} are`} shared with friends.`,
        'Then you can see what your friends shared.',
      ].join(' '),
      [{ text: 'Not yet', style: 'cancel' }, { text: 'Keep my week', onPress: () => publish.mutate() }],
    );

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={week.isRefetching} onRefresh={() => week.refetch()} tintColor={colors.ink3} />}
    >
      <ScreenHeader title="This week" subline={formatWeekRange(wk)} />

      <LastWeekCard weekStart={wk} />
      <GettingStartedCard weekStart={wk} momentsThisWeek={count} />
      <PromptCard count={count} sunday={sunday} published={published} />

      {week.isLoading ? (
        <Loading />
      ) : week.isError ? (
        <ErrorNote error={week.error} onRetry={() => week.refetch()} />
      ) : (
        <View style={styles.timeline}>
          <View style={styles.rail} />
          {weekDays(wk).map((day, i) => (
            <DayRow
              key={day}
              day={day}
              label={DAY_SHORT[i]}
              isToday={day === t}
              isFuture={day > t}
              snippets={snippets.filter((s) => s.happenedOn === day)}
              canAdd={canAdd}
              onAdd={() => openEditor({ weekStart: wk, day })}
            />
          ))}
        </View>
      )}

      {sunday && !published ? (
        <PrimaryButton
          title="Keep your week"
          onPress={confirmKeep}
          disabled={count === 0 || !online}
          loading={publish.isPending}
          style={{ marginTop: 20 }}
        />
      ) : null}
      {!sunday && !published ? (
        <Text style={[type.small, styles.footnote]}>Your moments are yours. On Sunday, look back and keep your week.</Text>
      ) : null}
    </Screen>
  );
}

function PromptCard({ count, sunday, published }: { count: number; sunday: boolean; published: boolean }) {
  let title: string;
  let sub: string;
  if (published) {
    title = 'Your week is kept.';
    sub = 'Friends’ shared moments are open now';
  } else if (sunday) {
    title = 'Looking back, what mattered this week?';
    sub = count === 0
      ? 'Add up to 3 moments, then keep your week.'
      : `${count} of 3 moments. Keep your week when you’re ready.`;
  } else {
    title = 'What mattered to you this week?';
    sub = count >= MAX ? 'These are your 3. Tap one to change it.' : 'Up to 3 moments, from any day this week.';
  }
  const Icon = published ? Check : Sparkles;
  return (
    <Card onPress={published ? () => router.navigate('/friends') : undefined} style={styles.prompt}>
      <Icon size={26} color={colors.accent} strokeWidth={1.5} />
      <View style={{ flex: 1 }}>
        <Text style={type.prompt}>{title}</Text>
        <Text style={[type.secondary, { marginTop: 2 }, published && { color: colors.accent }]}>
          {sub}
          {published ? ' →' : ''}
        </Text>
      </View>
    </Card>
  );
}

function DayRow({ day, label, isToday, isFuture, snippets, canAdd, onAdd }: {
  day: ISODate; label: string; isToday: boolean; isFuture: boolean;
  snippets: Snippet[]; canAdd: boolean; onAdd: () => void;
}) {
  const showAddSlot = isToday && canAdd;
  return (
    <View style={styles.dayRow}>
      <View style={styles.labelCol}>
        <Text
          style={[
            styles.dayLabel,
            isToday && { color: colors.accent, fontWeight: '500' },
            isFuture && { color: colors.ink3 },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 10 }}>
        {snippets.map((s) => (
          <MomentCard key={s.id} snippet={s} onPress={() => openEditor({ weekStart: s.weekStart, id: s.id })} />
        ))}
        {showAddSlot ? (
          <Card dashed onPress={onAdd} style={styles.addSlot}>
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>today</Text>
            </View>
            <View style={styles.addInner}>
              <Plus size={18} color={colors.accent} strokeWidth={iconStroke} />
              <Text style={styles.addText}>Add a moment</Text>
            </View>
          </Card>
        ) : null}
        {!snippets.length && !showAddSlot ? (
          <Pressable
            disabled={isFuture || !canAdd}
            onPress={onAdd}
            accessibilityLabel={`Add a moment on ${label}`}
            hitSlop={{ top: 8, bottom: 8 }}
            style={styles.emptyDay}
          >
            {!isFuture ? <View style={styles.dash} /> : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MomentCard({ snippet, onPress }: { snippet: Snippet; onPress: () => void }) {
  const cover = snippet.media[0];
  const shared = snippet.visibility === 'friends';
  const AudienceIcon = shared ? Users : Lock;
  return (
    <Card onPress={onPress} style={styles.moment}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={type.cardTitle} numberOfLines={2}>{snippet.title || 'Untitled moment'}</Text>
        {snippet.reflection ? (
          <Text style={[type.reflection, { fontSize: 15, lineHeight: 21, color: colors.ink2, marginTop: 3 }]} numberOfLines={1}>
            {snippet.reflection}
          </Text>
        ) : null}
        <View style={styles.audience}>
          <AudienceIcon size={12} color={colors.ink3} strokeWidth={iconStroke} />
          <Text style={styles.audienceText}>{shared ? 'Shared with friends' : 'Just for me'}</Text>
        </View>
      </View>
      {cover ? <MediaThumb item={cover} style={styles.thumb} rounded={12} /> : null}
    </Card>
  );
}

const LABEL_W = 52;

const styles = StyleSheet.create({
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 22 },
  timeline: { position: 'relative' },
  rail: {
    position: 'absolute',
    left: LABEL_W / 2 - 0.5,
    top: 6,
    bottom: 6,
    width: 1,
    backgroundColor: colors.hairlineStrong,
  },
  dayRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12, minHeight: 34 },
  labelCol: { width: LABEL_W, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  dayLabel: {
    fontSize: 16,
    color: colors.ink2,
    backgroundColor: colors.bg,
    paddingVertical: 4,
    textAlign: 'center',
    minWidth: 40,
  },
  moment: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingLeft: 16 },
  thumb: { width: 64, height: 64 },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  audienceText: { fontSize: 12, color: colors.ink3 },
  addSlot: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  todayPill: { backgroundColor: colors.accentSoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  todayPillText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  addInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginRight: 40 },
  addText: { color: colors.accent, fontSize: 16, fontWeight: '500' },
  emptyDay: { flex: 1, justifyContent: 'center' },
  dash: { width: 14, height: 1, backgroundColor: colors.hairlineStrong },
  footnote: { textAlign: 'center', marginTop: 18, color: colors.ink3 },
});
