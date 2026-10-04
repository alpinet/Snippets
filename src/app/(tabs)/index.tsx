import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { CalendarClock, Check, Plus, Sparkles } from 'lucide-react-native';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MediaThumb } from '../../components/media';
import { Card, ErrorNote, Loading, PrimaryButton, Screen, ScreenHeader } from '../../components/ui';
import { api, type Snippet } from '../../lib/api';
import { openEditor } from '../../lib/nav';
import { invalidateSnippets, useMyWeek } from '../../lib/queries';
import { useOnline } from '../../lib/useOnline';
import { useTick } from '../../lib/useTick';
import {
  DAY_SHORT, addDays, currentWeekStart, formatDay, formatWeekRange, isSunday, now, today, untilSunday, weekDays,
  type ISODate,
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
      await invalidateSnippets();
      router.navigate('/friends');
    },
  });

  const snippets = week.data?.snippets ?? [];
  const count = snippets.length;
  const published = week.data?.status === 'published';
  const canAdd = count < MAX;

  const confirmShare = () =>
    Alert.alert(
      'Share your week?',
      `Your ${count === 1 ? 'moment' : `${count} moments`} will be shared with your friends, and their weeks will open up for you.`,
      [{ text: 'Not yet', style: 'cancel' }, { text: 'Share', onPress: () => publish.mutate() }],
    );

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={week.isRefetching} onRefresh={() => week.refetch()} tintColor={colors.ink3} />}
    >
      <ScreenHeader large title="Snippets" subline={`This week · ${formatWeekRange(wk)}`} />

      <CheckInBanner weekStart={wk} sunday={sunday} published={published} />
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
          title="Share your week"
          onPress={confirmShare}
          disabled={count === 0 || !online}
          loading={publish.isPending}
          style={{ marginTop: 20 }}
        />
      ) : null}
      {!sunday && !published ? (
        <Text style={[type.small, styles.footnote]}>Drafts stay private until you share them on Sunday.</Text>
      ) : null}
    </Screen>
  );
}

/** When the next Sunday check-in is — a gentle countdown, not urgency (§38). */
function CheckInBanner({ weekStart, sunday, published }: { weekStart: ISODate; sunday: boolean; published: boolean }) {
  const thisSunday = addDays(weekStart, 6);
  let title: string;
  let detail: string;
  if (sunday && published) {
    title = `Next check-in ${formatDay(addDays(thisSunday, 7))}`;
    detail = 'in 7 days';
  } else if (sunday) {
    const n = now();
    const left = 24 * 60 - (n.getHours() * 60 + n.getMinutes());
    title = 'Check-in is open today';
    detail = `${Math.floor(left / 60)}h ${left % 60}m left`;
  } else {
    const { days, hours, minutes } = untilSunday();
    title = `Check-in opens ${formatDay(thisSunday)}`;
    detail = days > 0 ? `in ${days}d ${hours}h` : hours > 0 ? `in ${hours}h ${minutes}m` : `in ${minutes}m`;
  }
  return (
    <View style={styles.checkIn}>
      <CalendarClock size={20} color={colors.accent} strokeWidth={iconStroke} />
      <Text style={[type.body, { flex: 1, fontWeight: '500' }]}>{title}</Text>
      <View style={styles.checkInPill}>
        <Text style={styles.checkInPillText}>{detail}</Text>
      </View>
    </View>
  );
}

function PromptCard({ count, sunday, published }: { count: number; sunday: boolean; published: boolean }) {
  let title: string;
  let sub: string;
  if (published) {
    title = 'Your week is shared.';
    sub = 'See what your friends were up to';
  } else if (sunday) {
    title = 'What was your week like?';
    sub = count === 0 ? 'Add up to 3 moments from any day this week.' : `${count} of 3 moments ready to share.`;
  } else {
    title = 'What mattered to you this week?';
    sub = count >= MAX ? 'Your 3 moments are saved. Tap one to edit or swap it.' : 'Add up to 3 moments from any day this week.';
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
  return (
    <Card onPress={onPress} style={styles.moment}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={type.cardTitle} numberOfLines={2}>{snippet.title || 'Untitled moment'}</Text>
        {snippet.reflection ? (
          <Text style={[type.secondary, { marginTop: 3 }]} numberOfLines={1}>{snippet.reflection}</Text>
        ) : null}
      </View>
      {cover ? <MediaThumb item={cover} style={styles.thumb} rounded={12} /> : null}
    </Card>
  );
}

const LABEL_W = 52;

const styles = StyleSheet.create({
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 22 },
  checkIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  checkInPill: { backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  checkInPillText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
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
  addSlot: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  todayPill: { backgroundColor: colors.accentSoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  todayPillText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  addInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginRight: 40 },
  addText: { color: colors.accent, fontSize: 16, fontWeight: '500' },
  emptyDay: { flex: 1, justifyContent: 'center' },
  dash: { width: 14, height: 1, backgroundColor: colors.hairlineStrong },
  footnote: { textAlign: 'center', marginTop: 18, color: colors.ink3 },
});
