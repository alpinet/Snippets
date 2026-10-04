import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Snippet } from '../../lib/api';
import { formatDay } from '../../lib/week';
import { cardStyle, colors, gutter, iconStroke, type } from '../../theme';
import { MediaThumb } from '../media';
import { Avatar } from '../ui';
import { ClosingNote, openFriend, openSnippet, type FriendsLayoutProps } from './common';

/** The moment from a friend's week that got the most love (then the most photos, then the earliest). */
function pick(snippets: Snippet[]): Snippet {
  const score = (s: Snippet) => s.reactions.length + 2 * s.comments.length;
  return [...snippets].sort((a, b) => score(b) - score(a) || b.media.length - a.media.length)[0];
}

/**
 * Layout 3 — "Highlights": the week in a few big moments (one per friend),
 * then everyone's full weeks as compact rows.
 */
export function Highlights({ open, notPosted, sunday }: FriendsLayoutProps) {
  const { width } = useWindowDimensions();
  const heroW = width - gutter * 2;

  return (
    <View>
      <Text style={[type.prompt, { marginBottom: 12 }]}>The week in a few moments</Text>
      <View style={{ gap: 14 }}>
        {open.map((f) => {
          const s = pick(f.snippets);
          const cover = s.media[0];
          return (
            <Pressable
              key={f.friend.id}
              onPress={() => openSnippet(s)}
              style={({ pressed }) => [styles.hero, { width: heroW, height: heroW * 0.78 }, pressed && { opacity: 0.9 }]}
            >
              {cover ? <MediaThumb item={cover} style={StyleSheet.absoluteFill} rounded={18} /> : null}
              <View style={styles.caption}>
                <View style={styles.captionWho}>
                  <Avatar name={f.friend.displayName} url={f.friend.avatarUrl} size={22} />
                  <Text style={styles.captionName}>{f.friend.displayName} · {formatDay(s.happenedOn)}</Text>
                </View>
                <Text style={styles.captionTitle} numberOfLines={2}>{s.title || 'A moment'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={[type.label, { marginTop: 28, marginBottom: 8 }]}>Everyone’s weeks</Text>
      <View style={[cardStyle, { paddingHorizontal: 14 }]}>
        {open.map((f, i) => (
          <Pressable
            key={f.friend.id}
            onPress={() => openFriend(f.friend.id)}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.6 }]}
          >
            <Avatar name={f.friend.displayName} url={f.friend.avatarUrl} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontSize: 16, fontWeight: '500' }]}>{f.friend.displayName}</Text>
              <Text style={type.small} numberOfLines={1}>
                {f.snippets.map((s) => s.title).filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={styles.strip}>
              {f.snippets.slice(0, 3).map((s) =>
                s.media[0] ? <MediaThumb key={s.id} item={s.media[0]} style={styles.mini} rounded={7} showPlay={false} /> : null,
              )}
            </View>
            <ChevronRight size={18} color={colors.ink3} strokeWidth={iconStroke} />
          </Pressable>
        ))}
      </View>

      <ClosingNote notPosted={notPosted} sunday={sunday} text="That’s the week" />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.fill, justifyContent: 'flex-end' },
  caption: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(30, 22, 18, 0.34)' },
  captionWho: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  captionName: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },
  captionTitle: { color: '#fff', fontSize: 20, fontWeight: '500', letterSpacing: -0.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  strip: { flexDirection: 'row', gap: 4 },
  mini: { width: 34, height: 34 },
});
