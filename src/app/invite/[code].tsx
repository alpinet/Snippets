import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../../lib/api';
import { savePendingInvite, useAuth } from '../../lib/auth';
import { invalidateFriends } from '../../lib/queries';

/**
 * snippets://invite/<code>
 * Signed in → become friends right away. Otherwise stash the code; the root layout redeems it after sign-in.
 */
export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!code) return;
      if (!session) return savePendingInvite(code);
      try {
        const friend = await api.acceptInvite(code);
        await invalidateFriends();
        Alert.alert('You’re friends now', `You and ${friend.displayName} can now share weeks.`);
      } catch (e) {
        Alert.alert('Invite link', e instanceof Error ? e.message : 'That invite didn’t work.');
      }
    })().finally(() => setDone(true));
  }, [code, session]);

  return done ? <Redirect href="/" /> : null;
}
