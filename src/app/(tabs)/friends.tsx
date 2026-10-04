import { router } from 'expo-router';
import { Lock, UserPlus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chapters } from '../../components/friends/Chapters';
import { NudgeRow, type FriendsLayoutProps } from '../../components/friends/common';
import { Highlights } from '../../components/friends/Highlights';
import { SharedWeek } from '../../components/friends/SharedWeek';
import {
  Avatar, Card, EmptyState, ErrorNote, Hairline, Loading, PrimaryButton, Screen, ScreenHeader, TextButton,
} from '../../components/ui';
import { useFriendsWeek, useMe, useMyWeek, useRequests } from '../../lib/queries';
import { formatWeekRange, isSunday, socialWeekStart } from '../../lib/week';
import { colors, iconStroke, type } from '../../theme';

// Three ways to read the week; the choice is remembered on this device.
const LAYOUTS = [
  { key: 'timeline', label: 'Our week' },
  { key: 'chapters', label: 'Chapters' },
  { key: 'highlights', label: 'Highlights' },
] as const;
const LAYOUT_KEY = 'friends-layout';
type LayoutKey = (typeof LAYOUTS)[number]['key'];

export default function Friends() {
  const wk = socialWeekStart();
  const sunday = isSunday();
  const me = useMe();
  const week = useFriendsWeek(wk);
  const mine = useMyWeek(wk);
  const requests = useRequests();
  const incoming = requests.data?.filter((r) => r.direction === 'incoming').length ?? 0;
  const [layout, setLayoutState] = useState<LayoutKey>('timeline');
  useEffect(() => {
    AsyncStorage.getItem(LAYOUT_KEY)
      .then((v) => {
        if (LAYOUTS.some((l) => l.key === v)) setLayoutState(v as LayoutKey);
      })
      .catch(() => {});
  }, []);
  const setLayout = (v: LayoutKey) => {
    setLayoutState(v);
    AsyncStorage.setItem(LAYOUT_KEY, v).catch(() => {});
  };
  const scroller = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const all = week.data ?? [];
  const notPosted = all.filter((f) => !f.posted);
  const locked = all.filter((f) => f.posted && !f.unlocked);
  const open = all.filter((f) => f.unlocked && f.snippets.length);

  const refresh = () => Promise.all([week.refetch(), mine.refetch(), requests.refetch()]);

  return (
    <Screen
      ref={scroller}
      refreshControl={<RefreshControl refreshing={week.isRefetching} onRefresh={refresh} tintColor={colors.ink3} />}
    >
      <ScreenHeader
        title="Friends"
        subline={`Week of ${formatWeekRange(wk)}`}
        right={
          <Pressable
            onPress={() => router.push('/friends/manage')}
            hitSlop={12}
            style={styles.headerIcon}
            accessibilityLabel={incoming ? `Add friends, ${incoming} requests` : 'Add friends'}
          >
            <UserPlus size={24} color={colors.ink} strokeWidth={iconStroke} />
            {incoming ? <View style={styles.dot} /> : null}
          </Pressable>
        }
      />

      {week.isLoading || mine.isLoading ? (
        <Loading />
      ) : week.isError ? (
        <ErrorNote error={week.error} onRetry={refresh} />
      ) : all.length === 0 ? (
        <EmptyState
          title="Who do you want to share your weeks with?"
          body="Snippets is for a few close friends. Invite them and you’ll swap weeks every Sunday."
          action={<PrimaryButton title="Add friends" onPress={() => router.push('/friends/manage')} />}
        />
      ) : (
        <>
          {open.length ? (
            <>
              <View style={styles.switcher}>
                {LAYOUTS.map((l) => (
                  <Pressable
                    key={l.key}
                    onPress={() => setLayout(l.key)}
                    style={[styles.switch, layout === l.key && styles.switchOn]}
                  >
                    <Text style={[styles.switchText, layout === l.key && { color: colors.ink }]}>{l.label}</Text>
                  </Pressable>
                ))}
              </View>
              <FriendsLayout
                kind={layout}
                props={{ weekStart: wk, open, notPosted, sunday, meId: me.data?.id ?? '' }}
                onJump={(y) => scroller.current?.scrollTo({ y: Math.max(0, y - insets.top - 4), animated: true })}
              />
            </>
          ) : (
            <>
              {sunday && notPosted.length ? (
                <Card style={styles.listCard}>
                  <Text style={[type.cardTitle, { marginBottom: 6 }]}>Haven’t posted yet</Text>
                  {notPosted.map((f) => (
                    <NudgeRow key={f.friend.id} fw={f} />
                  ))}
                </Card>
              ) : null}

              {locked.length ? (
                <Card style={styles.listCard}>
                  <Text style={[type.cardTitle, { marginBottom: 6 }]}>
                    {sunday ? 'Shared their week' : 'Shared that week'}
                  </Text>
                  {locked.map((f) => (
                    <View key={f.friend.id} style={styles.row}>
                      <Avatar name={f.friend.displayName} url={f.friend.avatarUrl} size={40} />
                      <Text style={[type.body, { flex: 1, fontSize: 17 }]}>{f.friend.displayName}</Text>
                      <Lock size={16} color={colors.ink2} strokeWidth={iconStroke} />
                      <Text style={type.small}>{f.snippetCount} {f.snippetCount === 1 ? 'moment' : 'moments'}</Text>
                    </View>
                  ))}
                  <Hairline style={{ marginVertical: 12 }} />
                  {sunday ? (
                    <View style={styles.lockedFooter}>
                      <Text style={[type.secondary, { flex: 1 }]}>Share your week to see theirs.</Text>
                      <TextButton title="Your week" onPress={() => router.navigate('/')} />
                    </View>
                  ) : (
                    <Text style={type.secondary}>
                      You didn’t share that week, so theirs stay tucked away. Sunday’s a fresh start.
                    </Text>
                  )}
                </Card>
              ) : null}

              {!locked.length && !(sunday && notPosted.length) ? (
                <EmptyState
                  title={sunday ? 'Nobody’s shared yet' : 'A quiet week'}
                  body={sunday ? 'Weeks show up here as friends share them today.' : 'Nobody shared that week. Sunday’s a fresh start.'}
                />
              ) : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function FriendsLayout({ kind, props, onJump }: { kind: LayoutKey; props: FriendsLayoutProps; onJump: (y: number) => void }) {
  switch (kind) {
    case 'timeline':
      return <SharedWeek {...props} />;
    case 'chapters':
      return <Chapters {...props} onJump={onJump} />;
    case 'highlights':
      return <Highlights {...props} />;
  }
}

const styles = StyleSheet.create({
  headerIcon: { paddingTop: 6, paddingLeft: 12 },
  dot: {
    position: 'absolute',
    top: 4,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  listCard: { padding: 18, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  lockedFooter: { flexDirection: 'row', alignItems: 'center' },
  switcher: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: 12, padding: 3, marginBottom: 20 },
  switch: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  switchOn: { backgroundColor: colors.card },
  switchText: { fontSize: 13, fontWeight: '500', color: colors.ink2 },
});
