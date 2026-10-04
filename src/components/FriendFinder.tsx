import { useMutation, useQuery } from '@tanstack/react-query';
import { Link2, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { inviteLink } from '../lib/config';
import { invalidateFriends, useSettings } from '../lib/queries';
import { colors, iconStroke, radius, type } from '../theme';
import { Avatar, SecondaryButton, TextButton } from './ui';

export function InviteButton() {
  const settings = useSettings();
  return (
    <SecondaryButton
      title="Share your invite link"
      icon={<Link2 size={18} color={colors.ink} strokeWidth={iconStroke} />}
      disabled={!settings.data}
      onPress={() =>
        settings.data &&
        Share.share({
          message: `Join me on Snippets — a few moments from our weeks, shared on Sundays. ${inviteLink(settings.data.inviteCode)}`,
        })
      }
    />
  );
}

export function UserSearch() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.searchUsers(debounced),
    enabled: debounced.replace(/^@/, '').length >= 2,
  });

  const add = useMutation({
    mutationFn: (id: string) => api.sendFriendRequest(id),
    onSuccess: () => Promise.all([results.refetch(), invalidateFriends()]),
  });

  return (
    <View>
      <View style={styles.search}>
        <Search size={18} color={colors.ink3} strokeWidth={iconStroke} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by username"
          placeholderTextColor={colors.ink3}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      {results.data?.map((u) => (
        <View key={u.id} style={styles.row}>
          <Avatar name={u.displayName} url={u.avatarUrl} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { fontSize: 16 }]}>{u.displayName}</Text>
            <Text style={type.small}>@{u.username}</Text>
          </View>
          {u.relation === 'none' ? (
            <TextButton title="Add" onPress={() => add.mutate(u.id)} disabled={add.isPending} />
          ) : (
            <Text style={type.small}>{u.relation === 'friend' ? 'Friends' : 'Requested'}</Text>
          )}
        </View>
      ))}
      {results.data && !results.data.length ? (
        <Text style={[type.small, { marginTop: 12, textAlign: 'center' }]}>No one with that username yet.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 14,
    height: 48,
  },
  input: { flex: 1, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
});
