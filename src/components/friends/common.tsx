import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { REACTIONS, type FriendWeek, type Snippet } from '../../lib/api';
import { shareInvite } from '../../lib/invite';
import { useFriends, useNudge, useSettings } from '../../lib/queries';
import { colors, type } from '../../theme';
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
  const friends = useFriends();
  const settings = useSettings();
  const few = (friends.data?.length ?? 99) < 3;
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
      {few && settings.data ? (
        <View style={styles.invite}>
          <Text style={[type.small, { textAlign: 'center' }]}>Weeks are better with a few more people.</Text>
          <TextButton title="Invite someone" onPress={() => shareInvite(settings.data!.inviteCode)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closing: { alignItems: 'center', marginTop: 32, paddingHorizontal: 8 },
  invite: { alignItems: 'center', gap: 6, marginTop: 22 },
  closingRule: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
});
