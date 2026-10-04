import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ErrorBoundaryProps } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { AuthProvider, takePendingInvite, useAuth } from '../lib/auth';
import { OnboardingContext } from '../lib/onboarding';
import { identify, initMonitoring, reportError, wrapRoot } from '../lib/monitoring';
import { registerForPush, useNotificationRouting } from '../lib/push';
import { invalidateFriends, keys, queryClient } from '../lib/queries';
import { OfflineBanner } from '../components/OfflineBanner';
import { PrimaryButton } from '../components/ui';
import { colors, type } from '../theme';

initMonitoring();
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Gate />
            <OfflineBanner />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);

/** Last-resort screen if a render crashes. Reported to Sentry; the user can retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  reportError(error, { boundary: 'root' });
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 32, gap: 10 }}>
      <Text style={type.prompt}>Something went wrong.</Text>
      <Text style={type.secondary}>Your moments are safe. Let’s try that again.</Text>
      <PrimaryButton title="Try again" onPress={retry} style={{ marginTop: 16 }} />
    </View>
  );
}

function Gate() {
  const { ready, session } = useAuth();
  const me = useQuery({ queryKey: keys.me, queryFn: () => api.me(), enabled: !!session });
  // A user without a username is walked through onboarding. Once they start, they stay in the
  // flow (profile → add friends) until they finish, even after the username is saved.
  const [flowUser, setFlowUser] = useState<string | null>(null);
  const needsProfile = !!me.data && !me.data.username;
  if (session && needsProfile && flowUser !== session.userId) setFlowUser(session.userId);
  useNotificationRouting();

  const signedIn = !!session;
  const onboarding = signedIn && (needsProfile || flowUser === session.userId);
  const settled = ready && (!signedIn || !!me.data || me.isError);
  const inApp = signedIn && !onboarding && settled;

  useEffect(() => {
    if (settled) SplashScreen.hideAsync().catch(() => {});
  }, [settled]);

  useEffect(() => identify(session?.userId ?? null), [session?.userId]);

  // Once in the app: register for push, and redeem any invite link opened before sign-in.
  useEffect(() => {
    if (!inApp) return;
    registerForPush().catch(() => {});
    takePendingInvite().then(async (code) => {
      if (!code) return;
      try {
        const friend = await api.acceptInvite(code);
        await invalidateFriends();
        Alert.alert('You’re friends now', `You and ${friend.displayName} can now share weeks.`);
      } catch (e) {
        Alert.alert('Invite link', e instanceof Error ? e.message : 'That invite didn’t work.');
      }
    });
  }, [inApp]);

  const ctx = useMemo(() => ({ finish: () => setFlowUser(null) }), []);
  if (!settled) return null;

  return (
    <OnboardingContext.Provider value={ctx}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={onboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="snippet/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="snippet/[id]" />
          <Stack.Screen name="week/[weekStart]" />
          <Stack.Screen name="friend/[id]" />
          <Stack.Screen name="friends/manage" />
          <Stack.Screen name="backfill" />
          <Stack.Screen name="settings/profile" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Screen name="invite/[code]" />
      </Stack>
    </OnboardingContext.Provider>
  );
}
