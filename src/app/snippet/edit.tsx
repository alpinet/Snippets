import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ImagePlus, Shuffle } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaThumb } from '../../components/media';
import { TextButton } from '../../components/ui';
import { api, type DraftMedia, type MediaItem } from '../../lib/api';
import { track } from '../../lib/analytics';
import { pickMedia } from '../../lib/media';
import { useOnline } from '../../lib/useOnline';
import { invalidateSnippets, useMyWeek } from '../../lib/queries';
import {
  DAY_SHORT, currentWeekStart, formatWeekRange, parseISODate, today, weekDays, weekStartOf, type ISODate,
} from '../../lib/week';
import { colors, gutter, iconStroke, radius, type } from '../../theme';

// §7 — reflection, not a caption.
const PROMPTS = [
  'Why was this memorable?',
  'What made this stand out?',
  'What’s the story behind this?',
  'What do you want to remember about this?',
  'What would you tell a friend about this?',
];

const MAX_MEDIA = 3;

function asItem(m: DraftMedia): MediaItem {
  if (!m.local) return m;
  return {
    id: m.uri, kind: m.kind, url: m.uri, thumbUrl: null, cacheKey: m.uri,
    width: m.width, height: m.height, durationMs: m.durationMs,
  };
}

export default function EditSnippet() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ weekStart: string; day?: string; id?: string }>();
  const weekStart = params.weekStart ?? currentWeekStart();
  const week = useMyWeek(weekStart);
  const existing = params.id ? week.data?.snippets.find((s) => s.id === params.id) : undefined;
  const isEdit = !!params.id;
  const t = today();
  const isPastWeek = weekStart < currentWeekStart();
  const defaultDay = params.day ?? (weekStartOf(t) === weekStart ? t : weekStart);

  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [happenedOn, setHappenedOn] = useState<ISODate>(defaultDay);
  const [title, setTitle] = useState('');
  const [reflection, setReflection] = useState('');
  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [progress, setProgress] = useState<number | null>(null);
  const hydrated = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (hydrated.current || !existing) return;
    hydrated.current = true;
    setMedia(existing.media);
    setHappenedOn(existing.happenedOn);
    setTitle(existing.title);
    setReflection(existing.reflection);
  }, [existing]);

  // New moment: go straight to the camera roll (step 1).
  // Wait for the modal to finish presenting; iOS drops a picker presented mid-transition.
  useEffect(() => {
    if (isEdit) return;
    const t = setTimeout(addMedia, 550);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addMedia() {
    const res = await pickMedia(MAX_MEDIA - media.length);
    if (!res?.media.length) return;
    dirty.current = true;
    setMedia((prev) => [...prev, ...res.media].slice(0, MAX_MEDIA));
    // Pin to the day the photo was taken if it falls within this week.
    if (!isEdit && !params.day && res.takenOn && weekStartOf(res.takenOn) === weekStart && res.takenOn <= t) {
      setHappenedOn(res.takenOn);
    }
  }

  function editMedia(index: number) {
    const move = (delta: number) =>
      setMedia((prev) => {
        const next = [...prev];
        const [m] = next.splice(index, 1);
        next.splice(index + delta, 0, m);
        return next;
      });
    const remove = () => setMedia((prev) => prev.filter((_, i) => i !== index));
    const actions: { label: string; run: () => void; destructive?: boolean }[] = [];
    if (index > 0) actions.push({ label: 'Move earlier', run: () => move(-1) });
    if (index < media.length - 1) actions.push({ label: 'Move later', run: () => move(1) });
    actions.push({ label: 'Remove', run: remove, destructive: true });
    const done = (i: number) => {
      if (i < actions.length) {
        dirty.current = true;
        actions[i].run();
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), 'Cancel'],
          destructiveButtonIndex: actions.findIndex((a) => a.destructive),
          cancelButtonIndex: actions.length,
        },
        done,
      );
    } else {
      Alert.alert('Photo', undefined, [
        ...actions.map((a, i) => ({ text: a.label, style: a.destructive ? ('destructive' as const) : ('default' as const), onPress: () => done(i) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const saved = await api.saveSnippet(
        { id: params.id, weekStart, happenedOn, title, reflection, media },
        (f) => setProgress(f),
      );
      // Backfilling a past week puts it straight into the archive — no separate "save" step.
      if (isPastWeek && week.data?.status !== 'published' && week.data?.status !== 'backfilled') {
        await api.backfillWeek(weekStart);
      }
      return saved;
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      track('moment_saved', { media: media.length, backfill: isPastWeek, edit: isEdit });
      await invalidateSnippets();
      router.back();
    },
    onSettled: () => setProgress(null),
  });

  const del = useMutation({
    mutationFn: () => api.deleteSnippet(params.id!),
    onSuccess: async () => {
      await invalidateSnippets();
      router.back();
    },
  });

  const confirmDelete = () =>
    Alert.alert('Delete this moment?', 'Its photos and videos will be removed from Snippets.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
    ]);

  const cancel = () => {
    if (!dirty.current || save.isPending) return router.back();
    Alert.alert('Discard this moment?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const online = useOnline();
  const canSave = media.length > 0 && !save.isPending && online;
  const saveLabel = save.isPending
    ? progress !== null && progress < 1 ? `Saving ${Math.round(progress * 100)}%` : 'Saving…'
    : 'Save';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 10 }]}>
        <TextButton title="Cancel" color={colors.ink2} onPress={cancel} />
        <Text style={[type.cardTitle, { fontSize: 16 }]}>{isEdit ? 'Edit moment' : 'New moment'}</Text>
        <TextButton title={saveLabel} onPress={() => save.mutate()} disabled={!canSave} />
      </View>

      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {isPastWeek ? (
          <Text style={[type.small, { marginBottom: 12 }]}>Adding to the week of {formatWeekRange(weekStart)}</Text>
        ) : null}

        <View style={styles.mediaRow}>
          {media.map((m, i) => (
            <Pressable key={m.local ? m.uri : m.id} onPress={() => editMedia(i)} accessibilityLabel={`Photo ${i + 1}, options`}>
              <MediaThumb item={asItem(m)} style={styles.mediaTile} rounded={radius.md} />
            </Pressable>
          ))}
          {media.length < MAX_MEDIA ? (
            <Pressable onPress={addMedia} style={({ pressed }) => [styles.mediaTile, styles.addTile, pressed && { opacity: 0.7 }]}>
              <ImagePlus size={24} color={colors.accent} strokeWidth={iconStroke} />
              <Text style={[type.small, { color: colors.accent, marginTop: 6 }]}>
                {media.length ? 'Add more' : 'Choose photos'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[type.small, { marginTop: 8, color: colors.ink3 }]}>
          Up to 3 photos or short videos (15s) you already took.
        </Text>

        <Text style={[type.label, styles.label]}>Which day?</Text>
        <View style={styles.days}>
          {days.map((d, i) => {
            const disabled = d > t;
            const selected = d === happenedOn;
            return (
              <Pressable
                key={d}
                disabled={disabled}
                onPress={() => {
                  dirty.current = true;
                  setHappenedOn(d);
                }}
                style={[styles.day, selected && styles.daySelected, disabled && { opacity: 0.35 }]}
                accessibilityState={{ selected, disabled }}
              >
                <Text style={[styles.dayName, selected && { color: colors.accentInk }]}>{DAY_SHORT[i]}</Text>
                <Text style={[styles.dayNum, selected && { color: colors.accentInk }]}>{parseISODate(d).getDate()}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[type.label, styles.label]}>What was it?</Text>
        <TextInput
          value={title}
          onChangeText={(v) => {
            dirty.current = true;
            setTitle(v);
          }}
          placeholder="e.g. Philly day trip"
          placeholderTextColor={colors.ink3}
          style={[styles.input, { fontSize: 17 }]}
          maxLength={80}
          returnKeyType="next"
        />

        <View style={[styles.promptRow, styles.label]}>
          <Text style={[type.prompt, { flex: 1, fontSize: 17 }]}>{PROMPTS[promptIdx]}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setPromptIdx((i) => (i + 1) % PROMPTS.length)}
            accessibilityLabel="Ask a different question"
          >
            <Shuffle size={18} color={colors.ink2} strokeWidth={iconStroke} />
          </Pressable>
        </View>
        <TextInput
          value={reflection}
          onChangeText={(v) => {
            dirty.current = true;
            setReflection(v);
          }}
          placeholder="Optional — a line or two is plenty."
          placeholderTextColor={colors.ink3}
          style={[styles.input, styles.multiline]}
          multiline
          maxLength={1000}
          textAlignVertical="top"
        />

        <Text style={[type.small, { marginTop: 14, color: colors.ink3 }]}>
          {week.data?.status === 'published' || week.data?.status === 'backfilled'
            ? 'This week is already shared. Changes show up for friends right away.'
            : isPastWeek
              ? 'Goes straight into your archive. Backfilling never opens friends’ past weeks.'
              : 'Saved privately. Share it with your week on Sunday.'}
        </Text>

        {isEdit ? (
          <View style={{ marginTop: 36, alignItems: 'center' }}>
            <TextButton title="Delete this moment" color={colors.danger} onPress={confirmDelete} disabled={del.isPending} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const TILE = 100;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairlineStrong,
  },
  mediaRow: { flexDirection: 'row', gap: 10 },
  mediaTile: { width: TILE, height: TILE * 1.25 },
  addTile: {
    borderRadius: radius.md,
    borderWidth: 1.25,
    borderStyle: 'dashed',
    borderColor: 'rgba(191, 101, 71, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 26, marginBottom: 10 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 44,
    paddingVertical: 8,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  daySelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayName: { fontSize: 12, color: colors.ink2 },
  dayNum: { fontSize: 16, color: colors.ink, fontWeight: '500', marginTop: 2 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: { minHeight: 120, lineHeight: 22 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
