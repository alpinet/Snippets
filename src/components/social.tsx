import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { REACTIONS, type Comment, type Snippet } from '../lib/api';
import { useComment, useDeleteComment, useReact } from '../lib/queries';
import { chooseAction, reportContent } from '../lib/safety';
import { formatDay } from '../lib/week';
import { cardStyle, colors, iconStroke, radius, type } from '../theme';
import { Collage } from './media';

/** ❤️ 😂 😮 👍 — lightweight, counts de-emphasized (§13). */
export function ReactionBar({ snippet, meId }: { snippet: Snippet; meId: string }) {
  const react = useReact();
  const mine = snippet.reactions.find((r) => r.userId === meId)?.kind ?? null;
  const [optimistic, setOptimistic] = useState<typeof mine | undefined>(undefined);
  const current = optimistic === undefined ? mine : optimistic;
  const isOwner = snippet.userId === meId;

  if (isOwner) {
    if (!snippet.reactions.length) return null;
    return (
      <View style={styles.reactRow}>
        {REACTIONS.filter((r) => snippet.reactions.some((x) => x.kind === r.kind)).map((r) => (
          <Text key={r.kind} style={styles.receivedEmoji}>{r.emoji}</Text>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.reactRow}>
      {REACTIONS.map((r) => {
        const selected = current === r.kind;
        const others = snippet.reactions.filter((x) => x.kind === r.kind && x.userId !== meId).length;
        return (
          <Pressable
            key={r.kind}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            accessibilityState={{ selected }}
            hitSlop={6}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              const next = selected ? null : r.kind;
              setOptimistic(next);
              react.mutate({ snippetId: snippet.id, kind: next }, { onSettled: () => setOptimistic(undefined) });
            }}
            style={[styles.reactBtn, selected && styles.reactSelected]}
          >
            <Text style={[styles.emoji, !selected && current && { opacity: 0.55 }]}>{r.emoji}</Text>
            {others > 0 ? <Text style={styles.reactCount}>{others}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function CommentList({ comments, meId, ownerId, limit, onMore }: {
  comments: Comment[]; meId: string; ownerId: string; limit?: number; onMore?: () => void;
}) {
  const del = useDeleteComment();
  const shown = limit ? comments.slice(-limit) : comments;
  const hidden = comments.length - shown.length;

  const onLongPress = (c: Comment) => {
    const actions: { label: string; destructive?: boolean; run: () => void }[] = [];
    if (c.author.id !== meId) {
      actions.push({ label: 'Report comment', run: () => reportContent({ userId: c.author.id, commentId: c.id }, 'comment') });
    }
    if (c.author.id === meId || ownerId === meId) {
      actions.push({ label: 'Delete comment', destructive: true, run: () => del.mutate(c.id) });
    }
    chooseAction(undefined, actions);
  };

  if (!comments.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {hidden > 0 && onMore ? (
        <Pressable onPress={onMore} hitSlop={6}>
          <Text style={type.small}>View all {comments.length} comments</Text>
        </Pressable>
      ) : null}
      {shown.map((c) => (
        <Pressable key={c.id} onLongPress={() => onLongPress(c)} delayLongPress={350}>
          <Text style={type.body}>
            <Text style={{ fontWeight: '600' }}>{c.author.id === meId ? 'You' : c.author.displayName}: </Text>
            {c.body}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CommentInput({ snippetId }: { snippetId: string }) {
  const [text, setText] = useState('');
  const comment = useComment();
  const send = () => {
    const body = text.trim();
    if (!body) return;
    comment.mutate({ snippetId, body }, { onSuccess: () => setText('') });
  };
  return (
    <View style={styles.inputWrap}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Add a comment…"
        placeholderTextColor={colors.ink3}
        style={styles.input}
        maxLength={500}
        returnKeyType="send"
        onSubmitEditing={send}
        editable={!comment.isPending}
      />
      <Pressable onPress={send} hitSlop={10} accessibilityLabel="Send comment" disabled={!text.trim() || comment.isPending}>
        <Send size={20} color={text.trim() ? colors.accent : colors.ink3} strokeWidth={iconStroke} />
      </Pressable>
    </View>
  );
}

/** One snippet, spotlighted: date, collage, title, reflection, reactions, comments. */
export function SnippetCard({ snippet, meId, width, commentLimit = 2, social = true }: {
  snippet: Snippet; meId: string; width?: number; commentLimit?: number;
  /** false for private drafts: no reactions or comments yet. */
  social?: boolean;
}) {
  const open = () => router.push({ pathname: '/snippet/[id]', params: { id: snippet.id } });
  return (
    <View style={[cardStyle, styles.card, width ? { width } : null]}>
      <Collage media={snippet.media} height={200} onPress={open} />
      <Text style={[type.small, { marginTop: 12 }]}>{formatDay(snippet.happenedOn)}</Text>
      <Pressable onPress={open}>
        {snippet.title ? <Text style={[type.cardTitle, { fontSize: 19, marginTop: 4 }]}>{snippet.title}</Text> : null}
        {snippet.reflection ? (
          <Text style={[type.secondary, { marginTop: 4, color: '#6E655E' }]} numberOfLines={4}>{snippet.reflection}</Text>
        ) : null}
      </Pressable>
      {social ? (
        <>
          <View style={{ marginTop: 12 }}>
            <ReactionBar snippet={snippet} meId={meId} />
          </View>
          <View style={{ marginTop: 10 }}>
            <CommentList comments={snippet.comments} meId={meId} ownerId={snippet.userId} limit={commentLimit} onMore={open} />
          </View>
          <View style={{ marginTop: 12 }}>
            <CommentInput snippetId={snippet.id} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: radius.lg },
  reactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 40,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  reactSelected: { backgroundColor: colors.accentSoft },
  emoji: { fontSize: 21 },
  receivedEmoji: { fontSize: 17 },
  reactCount: { fontSize: 12, color: colors.ink3 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.sm + 2,
    paddingLeft: 14,
    paddingRight: 12,
    height: 44,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink, height: 44 },
});
