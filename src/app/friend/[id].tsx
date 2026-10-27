import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackBar } from '../../components/BackBar';
import { MediaThumb } from '../../components/media';
import { Avatar, Card, EmptyState, Hairline, Loading, Screen, TextButton } from '../../components/ui';
import { api } from '../../lib/api';
import { invalidateFriends, useFriendHistory, useFriends } from '../../lib/queries';
import { blockUser, reportContent } from '../../lib/safety';
import { formatDay, formatMonth, formatWeekRange, monthKey } from '../../lib/week';
import { colors, type } from '../../theme';

export default function FriendHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const friends = useFriends();
  const friend = friends.data?.find((f) => f.id === id);
  const history = useFriendHistory(id);

  const remove = useMutation({
    mutationFn: () => api.removeFriend(id),
    onSuccess: async () => {
      await invalidateFriends();
      router.back();
    },
  });

  const confirmRemove = () =>
    Alert.alert(`Remove ${friend?.displayName}?`, 'You’ll stop seeing each other’s weeks. They won’t be notified.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate() },
    ]);

  let lastMonth = '';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackBar />
      <Screen contentStyle={{ paddingTop: 0 }}>
        {friend ? (
          <View style={styles.head}>
            <Avatar name={friend.displayName} url={friend.avatarUrl} size={72} />
            <Text style={[type.title, { fontSize: 24, marginTop: 12 }]}>{friend.displayName}</Text>
            {friend.username ? <Text style={type.small}>@{friend.username}</Text> : null}
          </View>
        ) : null}

        {history.isLoading ? (
          <Loading />
        ) : !history.data?.length ? (
          <EmptyState title="Nothing here yet" body="Weeks you both share will collect here." />
        ) : (
          history.data.map((w) => {
            const mk = monthKey(w.weekStart);
            const showMonth = mk !== lastMonth;
            lastMonth = mk;
            return (
              <View key={w.weekStart}>
                {showMonth ? <Text style={[type.label, { marginTop: 18, marginBottom: 8 }]}>{formatMonth(w.weekStart)}</Text> : null}
                <Card style={{ paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12 }}>
                  <Text style={[type.small, { paddingTop: 8 }]}>{formatWeekRange(w.weekStart)}</Text>
                  {w.snippets.map((s, i) => (
                    <View key={s.id}>
                      {i > 0 ? <Hairline /> : null}
                      <Pressable
                        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                        onPress={() => router.push({ pathname: '/snippet/[id]', params: { id: s.id } })}
                      >
                        {s.media[0] ? <MediaThumb item={s.media[0]} style={styles.thumb} rounded={10} /> : null}
                        <View style={{ flex: 1 }}>
                          <Text style={type.cardTitle} numberOfLines={1}>{s.title || 'A moment'}</Text>
                          <Text style={type.small}>{formatDay(s.happenedOn)}</Text>
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            );
          })
        )}

        {friend ? (
          <View style={{ alignItems: 'center', marginTop: 28, gap: 20 }}>
            <TextButton title="Remove friend" color={colors.danger} onPress={confirmRemove} disabled={remove.isPending} />
            <View style={{ flexDirection: 'row', gap: 28 }}>
              <TextButton title="Report" color={colors.ink2} onPress={() => reportContent({ userId: id }, 'person')} />
              <TextButton title="Block" color={colors.ink2} onPress={() => blockUser(id, friend.displayName, () => router.back())} />
            </View>
          </View>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  thumb: { width: 52, height: 52 },
});
