import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { Archive, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { shareInvite } from '../lib/invite';
import { openEditor } from '../lib/nav';
import { invalidateSnippets, useArchive, useFriends, useMyWeek, useSettings } from '../lib/queries';
import { addDays, formatWeekRange, type ISODate } from '../lib/week';
import { cardStyle, colors, iconStroke, type } from '../theme';
import { TextButton } from './ui';

const DISMISSED_KEY = 'dismissed-last-week';

/**
 * Last week ended with private drafts that were never shared: offer to keep them in the archive
 * (one tap), instead of leaving them as "not saved yet".
 */
export function LastWeekCard({ weekStart }: { weekStart: ISODate }) {
  const lastWeek = addDays(weekStart, -7);
  const week = useMyWeek(lastWeek);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then(setDismissed).catch(() => {});
  }, []);

  const keep = useMutation({ mutationFn: () => api.backfillWeek(lastWeek), onSuccess: invalidateSnippets });

  const n = week.data?.snippets.length ?? 0;
  if (week.data?.status !== 'draft' || n === 0 || dismissed === lastWeek || keep.isSuccess) return null;

  const dismiss = () => {
    setDismissed(lastWeek);
    AsyncStorage.setItem(DISMISSED_KEY, lastWeek).catch(() => {});
  };

  return (
    <View style={[cardStyle, styles.card]}>
      <Archive size={20} color={colors.accent} strokeWidth={iconStroke} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontWeight: '500' }]}>
          Last week isn’t kept yet.
        </Text>
        <Text style={[type.small, { marginTop: 2 }]}>
          Keep {n === 1 ? 'its moment' : `its ${n} moments`} in your Lookback for {formatWeekRange(lastWeek)}?
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TextButton title={keep.isPending ? 'Keeping…' : 'Keep it'} onPress={() => keep.mutate()} disabled={keep.isPending} />
        </View>
      </View>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss">
        <X size={18} color={colors.ink3} strokeWidth={iconStroke} />
      </Pressable>
    </View>
  );
}

/** A brand-new account: start with one moment of your own; friends are optional and come second. */
export function GettingStartedCard({ weekStart, momentsThisWeek }: { weekStart: ISODate; momentsThisWeek: number }) {
  const archive = useArchive();
  const friends = useFriends();
  const settings = useSettings();
  const isNew = momentsThisWeek === 0 && archive.data?.length === 0;
  const noFriends = friends.data?.length === 0;
  if (!isNew && !noFriends) return null;
  if (!archive.data || !friends.data) return null;

  return (
    <View style={[cardStyle, styles.card, { alignItems: 'flex-start' }]}>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={[type.body, { fontWeight: '500' }]}>{isNew ? 'Start with one moment' : 'When you’re ready'}</Text>
        {isNew ? (
          <Step label="What’s one thing from this week you want to keep?" onPress={() => openEditor({ weekStart })} />
        ) : null}
        {noFriends ? (
          <Step
            label="Optional: share weeks with a close friend"
            onPress={() => settings.data && shareInvite(settings.data.inviteCode)}
          />
        ) : null}
      </View>
    </View>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.step, pressed && { opacity: 0.6 }]}>
      <View style={styles.stepDot} />
      <Text style={[type.secondary, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  stepDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.accent },
});
