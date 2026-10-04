import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const monitoringEnabled = !!dsn && !__DEV__;

/** Crash + error reporting. No-op until EXPO_PUBLIC_SENTRY_DSN is set (and never in dev). */
export function initMonitoring() {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn,
    environment: (Constants.expoConfig?.extra?.appVariant as string | undefined) ?? 'production',
    sendDefaultPii: false, // never attach IPs, emails or request bodies
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

/** Report a handled error with optional context. Safe to call anywhere. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) console.warn('[error]', error, context ?? '');
  if (!monitoringEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Tag reports with the opaque user id only — no names, emails or content. */
export function identify(userId: string | null) {
  if (monitoringEnabled) Sentry.setUser(userId ? { id: userId } : null);
}

export const wrapRoot = <P extends Record<string, unknown>>(C: React.ComponentType<P>) =>
  monitoringEnabled ? Sentry.wrap(C) : C;
