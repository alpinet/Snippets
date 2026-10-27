import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDayLong } from '../../lib/week';
import { cardStyle, colors, type } from '../../theme';
import { Collage } from '../media';
import { Avatar, TextButton } from '../ui';
import { ClosingNote, MomentMeta, openFriend, openSnippet, type FriendsLayoutProps } from './common';

/**
 * Layout 2 — "Chapters": each friend's week reads like a short journal page, in order,
 * with a small table of contents up top and a closing line at the end.
 */
export function Chapters({ open, notPosted, sunday, onJump }: FriendsLayoutProps & { onJump: (y: number) => void }) {
  const rootY = useRef(0);
  const offsets = useRef<Record<string, number>>({});

  return (
    <View onLayout={(e) => (rootY.current = e.nativeEvent.layout.y)}>
      <Text style={[type.small, { marginBottom: 8 }]}>In this week</Text>
      <View style={styles.toc}>
        {open.map((f) => (
          <Pressable
            key={f.friend.id}
            onPress={() => onJump(rootY.current + (offsets.current[f.friend.id] ?? 0) - 8)}
            style={({ pressed }) => [styles.tocChip, pressed && { opacity: 0.6 }]}
          >
            <Avatar name={f.friend.displayName} url={f.friend.avatarUrl} size={22} />
            <Text style={[type.body, { fontSize: 14 }]}>{f.friend.displayName}</Text>
            <Text style={type.small}>{f.snippets.length}</Text>
          </Pressable>
        ))}
      </View>

      {open.map((f) => (
        <View
          key={f.friend.id}
          onLayout={(e) => (offsets.current[f.friend.id] = e.nativeEvent.layout.y)}
          style={[cardStyle, styles.chapter]}
        >
          <Pressable style={styles.chapterHead} onPress={() => openFriend(f.friend.id)}>
            <Avatar name={f.friend.displayName} url={f.friend.avatarUrl} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[type.prompt, { fontSize: 20 }]}>{f.friend.displayName}’s week</Text>
              <Text style={type.small}>
                {f.snippets.length} {f.snippets.length === 1 ? 'moment' : 'moments'}
              </Text>
            </View>
          </Pressable>

          {f.snippets.map((s, i) => (
            <View key={s.id} style={[styles.entry, i === 0 && { marginTop: 4 }]}>
              <Text style={styles.day}>{formatDayLong(s.happenedOn)}</Text>
              {s.title ? <Text style={[type.cardTitle, { fontSize: 18, marginTop: 2 }]}>{s.title}</Text> : null}
              {s.reflection ? <Text style={styles.reflection}>{s.reflection}</Text> : null}
              <View style={{ marginTop: 10 }}>
                <Collage media={s.media} height={190} onPress={() => openSnippet(s)} />
              </View>
              <View style={styles.footer}>
                <MomentMeta snippet={s} />
                <View style={{ flex: 1 }} />
                <TextButton title="React or reply" onPress={() => openSnippet(s)} style={{ fontSize: 14 }} />
              </View>
            </View>
          ))}
        </View>
      ))}

      <ClosingNote notPosted={notPosted} sunday={sunday} text="You’re all caught up" />
    </View>
  );
}

const styles = StyleSheet.create({
  toc: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tocChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  chapter: { padding: 18, marginBottom: 18 },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  entry: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  day: { fontSize: 13, fontWeight: '500', color: colors.accent },
  reflection: { fontSize: 16, lineHeight: 23, color: '#5E5550', marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
});
