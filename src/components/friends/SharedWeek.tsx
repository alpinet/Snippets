import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DAY_SHORT, weekDays } from '../../lib/week';
import { cardStyle, colors, type } from '../../theme';
import { MediaThumb } from '../media';
import { Avatar } from '../ui';
import { ClosingNote, MomentMeta, openSnippet, type FriendsLayoutProps } from './common';

/**
 * Layout 1 — "Our week": everyone's moments on one Monday → Sunday rail, like Home.
 * Opens with who shared, ends with who's still to come.
 */
export function SharedWeek({ weekStart, open, notPosted, sunday }: FriendsLayoutProps) {
  const entries = open.flatMap((f) => f.snippets.map((s) => ({ s, friend: f.friend })));
  const total = entries.length;

  return (
    <View>
      <View style={styles.intro}>
        <View style={{ flexDirection: 'row' }}>
          {open.slice(0, 5).map((f, i) => (
            <View key={f.friend.id} style={{ marginLeft: i ? -8 : 0 }}>
              <Avatar name={f.friend.displayName} url={f.friend.avatarUrl} size={30} />
            </View>
          ))}
        </View>
        <Text style={[type.secondary, { flex: 1 }]}>
          {open.length} {open.length === 1 ? 'friend' : 'friends'} shared {total} {total === 1 ? 'moment' : 'moments'}{' '}
          {sunday ? 'this week' : 'that week'}
        </Text>
      </View>

      <View style={styles.timeline}>
        <View style={styles.rail} />
        {weekDays(weekStart).map((day, i) => {
          const today = entries
            .filter((e) => e.s.happenedOn === day)
            .sort((a, b) => a.s.createdAt.localeCompare(b.s.createdAt));
          return (
            <View key={day} style={styles.dayRow}>
              <View style={styles.labelCol}>
                <Text style={styles.dayLabel}>{DAY_SHORT[i]}</Text>
              </View>
              <View style={{ flex: 1, gap: 10 }}>
                {today.length ? (
                  today.map(({ s, friend }) => (
                    <Pressable
                      key={s.id}
                      onPress={() => openSnippet(s)}
                      style={({ pressed }) => [cardStyle, styles.entry, pressed && { opacity: 0.85 }]}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <View style={styles.who}>
                          <Avatar name={friend.displayName} url={friend.avatarUrl} size={20} />
                          <Text style={type.small}>{friend.displayName}</Text>
                        </View>
                        <Text style={type.cardTitle} numberOfLines={2}>{s.title || 'A moment'}</Text>
                        {s.reflection ? (
                          <Text style={[type.secondary, { marginTop: 3 }]} numberOfLines={2}>{s.reflection}</Text>
                        ) : null}
                        <MomentMeta snippet={s} style={{ marginTop: 8 }} />
                      </View>
                      {s.media[0] ? <MediaThumb item={s.media[0]} style={styles.thumb} rounded={12} /> : null}
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.quiet}>a quiet day</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <ClosingNote notPosted={notPosted} sunday={sunday} />
    </View>
  );
}

const LABEL_W = 52;

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  timeline: { position: 'relative' },
  rail: { position: 'absolute', left: LABEL_W / 2 - 0.5, top: 6, bottom: 6, width: 1, backgroundColor: colors.hairlineStrong },
  dayRow: { flexDirection: 'row', marginBottom: 12, minHeight: 30 },
  labelCol: { width: LABEL_W, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontSize: 16, color: colors.ink2, backgroundColor: colors.bg, paddingVertical: 4, minWidth: 40, textAlign: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  thumb: { width: 72, height: 72 },
  quiet: { fontSize: 14, color: colors.ink3, fontStyle: 'italic', alignSelf: 'flex-start', marginTop: 6 },
});
