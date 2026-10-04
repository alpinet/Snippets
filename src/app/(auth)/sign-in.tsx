import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { BackBar } from '../../components/BackBar';
import { Hairline, PrimaryButton, SecondaryButton, TextButton } from '../../components/ui';
import { api } from '../../lib/api';
import { links } from '../../lib/config';
import { colors, gutter, radius, type } from '../../theme';

// The native Apple button isn't bundled in Expo Go; real builds use it.
const nativeAppleButton = Platform.OS === 'ios' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export default function SignIn() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'apple' | 'google' | 'email'>(null);

  async function run(kind: 'apple' | 'google' | 'email', fn: () => Promise<unknown>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return;
      Alert.alert('Couldn’t sign in', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const submitEmail = () =>
    run('email', async () => {
      if (mode === 'signIn') return api.signInWithEmail(email, password);
      const { needsConfirmation } = await api.signUpWithEmail(email, password);
      if (needsConfirmation) {
        Alert.alert('Check your email', 'We sent you a link to confirm your address. Come back here after tapping it.');
        setMode('signIn');
      }
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.title}>{mode === 'signIn' ? 'Welcome back' : 'Make your space'}</Text>
        <Text style={[type.subline, { marginTop: 4, marginBottom: 28 }]}>
          {mode === 'signIn' ? 'Sign in to see your weeks.' : 'Just you and a few friends.'}
        </Text>

        {nativeAppleButton ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              mode === 'signIn'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.md}
            style={{ height: 50 }}
            onPress={() => run('apple', () => api.signInWithApple())}
          />
        ) : (
          <SecondaryButton title="Continue with Apple" onPress={() => run('apple', () => api.signInWithApple())} disabled={!!busy} />
        )}
        <SecondaryButton
          title="Continue with Google"
          onPress={() => run('google', () => api.signInWithGoogle())}
          disabled={!!busy}
          style={{ marginTop: 12 }}
        />

        <View style={styles.or}>
          <Hairline style={{ flex: 1 }} />
          <Text style={type.small}>or with email</Text>
          <Hairline style={{ flex: 1 }} />
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.ink3}
          style={styles.input}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signUp' ? 'Password (8+ characters)' : 'Password'}
          placeholderTextColor={colors.ink3}
          style={[styles.input, { marginTop: 10 }]}
          secureTextEntry
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          onSubmitEditing={submitEmail}
        />
        <PrimaryButton
          title={mode === 'signIn' ? 'Sign in' : 'Create account'}
          onPress={submitEmail}
          loading={busy === 'email'}
          disabled={!email.includes('@') || password.length < (mode === 'signUp' ? 8 : 1) || !!busy}
          style={{ marginTop: 16 }}
        />
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <TextButton
            title={mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
            onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          />
        </View>

        <Text style={[type.small, styles.legal]}>
          By continuing you agree to the{' '}
          <Text style={{ color: colors.ink }} onPress={() => WebBrowser.openBrowserAsync(links.terms)}>Terms</Text> and{' '}
          <Text style={{ color: colors.ink }} onPress={() => WebBrowser.openBrowserAsync(links.privacy)}>Privacy Policy</Text>.
        </Text>
        {api.mode === 'demo' ? (
          <Text style={[type.small, styles.legal]}>Demo mode: any sign-in method works with sample data.</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter + 8, paddingTop: 12, paddingBottom: 40 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    color: colors.ink,
  },
  legal: { textAlign: 'center', marginTop: 24, color: colors.ink3, lineHeight: 18 },
});
