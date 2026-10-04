import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackBar } from '../../components/BackBar';
import { InviteButton, UserSearch } from '../../components/FriendFinder';
import { Avatar, Card, Hairline, Screen, SectionLabel, TextButton } from '../../components/ui';
import { api } from '../../lib/api';
import { invalidateFriends, useFriends, useRequests } from '../../lib/queries';
import { colors, iconStroke, type } from '../../theme';

export default function ManageFriends() {
  const friends = useFriends();
  const requests = useRequests();
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api.respondToRequest(id, accept),
    onSuccess: invalidateFriends,
  });
  const incoming = requests.data?.filter((r) => r.direction === 'incoming') ?? [];
  const outgoing = requests.data?.filter((r) => r.direction === 'outgoing') ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackBar title="Friends" />
      <Screen contentStyle={{ paddingTop: 8 }}>
        {incoming.length ? (
          <>
            <SectionLabel>Wants to be friends</SectionLabel>
            <Card style={styles.group}>
              {incoming.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Hairline /> : null}
                  <View style={styles.row}>
                    <Avatar name={r.profile.displayName} url={r.profile.avatarUrl} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { fontSize: 16 }]}>{r.profile.displayName}</Text>
                      {r.profile.username ? <Text style={type.small}>@{r.profile.username}</Text> : null}
                    </View>
                    <TextButton title="Decline" color={colors.ink2} onPress={() => respond.mutate({ id: r.id, accept: false })} />
                    <TextButton title="Accept" onPress={() => respond.mutate({ id: r.id, accept: true })} />
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionLabel style={{ marginTop: incoming.length ? 26 : 0 }}>Add friends</SectionLabel>
        <Text style={[type.secondary, { marginBottom: 14 }]}>
          Snippets works best with a handful of people you actually want to keep up with.
        </Text>
        <InviteButton />
        <View style={{ height: 14 }} />
        <UserSearch />

        {outgoing.length ? (
          <>
            <SectionLabel style={{ marginTop: 26 }}>Requested</SectionLabel>
            <Card style={styles.group}>
              {outgoing.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Hairline /> : null}
                  <View style={styles.row}>
                    <Avatar name={r.profile.displayName} url={r.profile.avatarUrl} size={36} />
                    <Text style={[type.body, { flex: 1, fontSize: 16 }]}>{r.profile.displayName}</Text>
                    <Text style={type.small}>Waiting</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionLabel style={{ marginTop: 26 }}>
          Your friends{friends.data ? ` · ${friends.data.length}` : ''}
        </SectionLabel>
        {friends.data?.length ? (
          <Card style={styles.group}>
            {friends.data.map((f, i) => (
              <View key={f.id}>
                {i > 0 ? <Hairline /> : null}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                  onPress={() => router.push({ pathname: '/friend/[id]', params: { id: f.id } })}
                >
                  <Avatar name={f.displayName} url={f.avatarUrl} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { fontSize: 16 }]}>{f.displayName}</Text>
                    {f.username ? <Text style={type.small}>@{f.username}</Text> : null}
                  </View>
                  <ChevronRight size={18} color={colors.ink3} strokeWidth={iconStroke} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Text style={type.secondary}>No friends yet — share your invite link to start.</Text>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
