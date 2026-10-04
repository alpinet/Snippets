import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, type Profile } from '../lib/api';
import { pickAvatar } from '../lib/media';
import { keys, queryClient } from '../lib/queries';
import { colors, radius, type } from '../theme';
import { Avatar, PrimaryButton } from './ui';

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function ProfileForm({ initial, submitLabel, onDone }: {
  initial?: Profile; submitLabel: string; onDone: () => void;
}) {
  const [name, setName] = useState(initial?.displayName === 'Friend' ? '' : initial?.displayName ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined); // undefined = unchanged
  const [checked, setChecked] = useState<{ username: string; ok: boolean } | null>(null);

  const u = username.trim().toLowerCase();
  const validFormat = USERNAME_RE.test(u);

  const available = checked?.username === u ? checked.ok : null;

  useEffect(() => {
    if (!validFormat || u === initial?.username) return;
    const t = setTimeout(() => {
      api.isUsernameAvailable(u).then((ok) => setChecked({ username: u, ok })).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [u, validFormat, initial?.username]);

  const save = useMutation({
    mutationFn: () =>
      api.updateProfile({
        displayName: name,
        ...(u !== initial?.username ? { username: u } : null),
        ...(avatar !== undefined ? { avatarUri: avatar } : null),
      }),
    onSuccess: (p) => {
      queryClient.setQueryData(keys.me, p);
      onDone();
    },
  });

  let hint = 'Friends find you by this. Letters, numbers, _ and .';
  let hintColor: string = colors.ink3;
  if (u && !validFormat) {
    hint = '3–20 characters: letters, numbers, _ or .';
    hintColor = colors.danger;
  } else if (available === false) {
    hint = 'That one’s taken.';
    hintColor = colors.danger;
  } else if (available === true) {
    hint = 'That one’s yours.';
    hintColor = colors.accent;
  }

  const canSave = name.trim().length > 0 && validFormat && available !== false && !save.isPending;
  const avatarUrl = avatar === undefined ? initial?.avatarUrl : avatar;

  return (
    <View>
      <Pressable
        style={styles.avatarWrap}
        onPress={async () => {
          const uri = await pickAvatar();
          if (uri) setAvatar(uri);
        }}
      >
        <Avatar name={name || '?'} url={avatarUrl} size={92} />
        <Text style={[type.small, { color: colors.accent, marginTop: 10 }]}>
          {avatarUrl ? 'Change photo' : 'Add a photo (optional)'}
        </Text>
      </Pressable>

      <Text style={[type.label, styles.label]}>Your name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="What friends call you"
        placeholderTextColor={colors.ink3}
        style={styles.input}
        maxLength={40}
        autoComplete="name"
        textContentType="name"
      />

      <Text style={[type.label, styles.label]}>Username</Text>
      <View style={[styles.input, styles.usernameRow]}>
        <Text style={{ color: colors.ink3, fontSize: 17 }}>@</Text>
        <TextInput
          value={username}
          onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
          placeholder="username"
          placeholderTextColor={colors.ink3}
          style={{ flex: 1, fontSize: 17, color: colors.ink, paddingVertical: 0 }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          textContentType="username"
        />
      </View>
      <Text style={[type.small, { marginTop: 6, color: hintColor }]}>{hint}</Text>

      <PrimaryButton title={submitLabel} onPress={() => save.mutate()} disabled={!canSave} loading={save.isPending} style={{ marginTop: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', marginBottom: 12 },
  label: { marginTop: 22, marginBottom: 8 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 17,
    color: colors.ink,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
