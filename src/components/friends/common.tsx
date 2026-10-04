import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { REACTIONS, type FriendWeek, type Snippet } from '../../lib/api';
import { useNudge } from '../../lib/queries';
import { formatWeekRange } from '../../lib/week';
import { colors, gutter, type } from '../../theme';
import { SnippetCard } from '../social';
import { Avatar, TextButton } from '../ui';

/** Props every Friends layout receives. */
export type FriendsLayoutProps = {
  weekStart: string;
  open: FriendWeek[]; // friends whose week is unlocked, with moments
  notPosted: FriendWeek[];
  sunday: boolean;
  meId: string;
};

export function listNames(names: string[]) {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export const openSnippet = (s: Snippet) => router.push({ pathname: '/snippet/[id]', params: { id: s.id } });
export const openFriend = (id: string) => router.push({ pathname: '/friend/[id]', params: { id } });

export function NudgeRow({ fw, compact }: { fw: FriendWeek; compact?: boolean }) {
  const nudge = useNudge();
  const done = fw.nudged || nudge.isSuccess;
  return (
    <View style={[styles.row, compact && { paddingVertical: 2 }]}>
      <Avatar name={fw.friend.displayName} url={fw.friend.avatarUrl} size={compact ? 28 : 40} />
      <Text style={[type.body, { flex: 1, fontSize: compact ? 15 : 17 }]}>{fw.friend.displayName}</Text>
      <TextButton
        title={done ? 'Nudged' : 'Nudge'}
        disabled={done || nudge.isPending}
        onPress={() => nudge.mutate(fw.friend.id)}
      />
    </View>
  );
}

/** Quiet "❤️ 😂 · 2 replies" line. */
export function MomentMeta({ snippet, style }: { snippet: Snippet; style?: object }) {
  const reacted = REACTIONS.filter((r) => snippet.reactions.some((x) => x.kind === r.kind));
  const replies = snippet.comments.length;
  if (!reacted.length && !replies) return null;
  return (
    <View style={[styles.meta, style]}>
      {reacted.map((r) => (
        <Text key={r.kind} style={{ fontSize: 13 }}>{r.emoji}</Text>
      ))}
      {reacted.length && replies ? <Text style={type.small}>·</Text> : null}
      {replies ? <Text style={type.small}>{replies} {replies === 1 ? 'reply' : 'replies'}</Text> : null}
    </View>
  );
}

/** The end of the week's story: who's missing (with a quiet nudge on Sunday). */
export function ClosingNote({ notPosted, sunday, text = 'That’s everyone’s week' }: {
  notPosted: FriendWeek[]; sunday: boolean; text?: string;
}) {
  return (
    <View style={styles.closing}>
      <View style={styles.closingRule}>
        <View style={styles.rule} />
        <Text style={[type.small, { color: colors.ink3 }]}>{text}</Text>
        <View style={styles.rule} />
      </View>
      {notPosted.length ? (
        sunday ? (
          <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
            <Text style={[type.small, { textAlign: 'center', marginBottom: 6 }]}>Still to come</Text>
            {notPosted.map((f) => (
              <NudgeRow key={f.friend.id} fw={f} compact />
            ))}
          </View>
        ) : (
          <Text style={[type.small, { textAlign: 'center', marginTop: 8, color: colors.ink3 }]}>
            {listNames(notPosted.map((f) => f.friend.displayName))} didn’t share that week.
          </Text>
        )
      ) : null}
    </View>
  );
}

/** The original layout: one section per friend with a carousel of moment cards. */
export function CardsLayout({ open, notPosted, sunday, meId }: FriendsLayoutProps) {
  return (
    <View>
      {open.map((f, i) => (
        <View key={f.friend.id} style={i ? { marginTop: 28 } : null}>
          <FriendCarousel fw={f} meId={meId} />
        </View>
      ))}
      <ClosingNote notPosted={notPosted} sunday={sunday} />
    </View>
  );
}

function FriendCarousel({ fw, meId }: { fw: FriendWeek; meId: string }) {
  const { width } = useWindowDimensions();
  const cardW = width - gutter * 2;
  const gap = 12;
  const [page, setPage] = useState(0);
  const n = fw.snippets.length;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / (cardW + gap));
    if (p !== page) setPage(p);
  };
  return (
    <View>
      <Pressable style={styles.overview} onPress={() => openFriend(fw.friend.id)}>
        <Avatar name={fw.friend.displayName} url={fw.friend.avatarUrl} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[type.cardTitle, { fontSize: 18 }]}>{fw.friend.displayName}</Text>
          <Text style={type.small}>
            {n} {n === 1 ? 'snippet' : 'snippets'} · {formatWeekRange(fw.snippets[0].weekStart, true)}
          </Text>
        </View>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + gap}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={{ marginHorizontal: -gutter }}
        contentContainerStyle={{ paddingHorizontal: gutter, gap, paddingVertical: 4 }}
      >
        {fw.snippets.map((s) => (
          <SnippetCard key={s.id} snippet={s} meId={meId} width={cardW} />
        ))}
      </ScrollView>
      {n > 1 ? (
        <View style={styles.dots}>
          {fw.snippets.map((s, i) => (
            <View key={s.id} style={[styles.pageDot, i === page && { backgroundColor: colors.accent }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closing: { alignItems: 'center', marginTop: 32, paddingHorizontal: 8 },
  closingRule: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
  overview: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12, marginTop: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairlineStrong },
});
