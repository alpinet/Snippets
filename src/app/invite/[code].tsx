import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { savePendingInvite, useAuth } from '../../lib/auth';
import { redeemInvite } from '../../lib/invite';

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
      await redeemInvite(code);
    })().finally(() => setDone(true));
  }, [code, session]);

  return done ? <Redirect href="/" /> : null;
}
