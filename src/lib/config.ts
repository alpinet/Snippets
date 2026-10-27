import Constants from 'expo-constants';

// Public URLs. Override via EXPO_PUBLIC_* env vars (see .env.example).

/** URL scheme of this build variant: snippets, snippets-beta or snippets-dev. */
export const appScheme = (Constants.expoConfig?.scheme as string | undefined) ?? 'snippets';
const site = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://snippets.app';

export const links = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_URL ?? `${site}/privacy`,
  terms: process.env.EXPO_PUBLIC_TERMS_URL ?? `${site}/terms`,
  support: process.env.EXPO_PUBLIC_SUPPORT_URL ?? `${site}/support`,
};

/**
 * Invite links. With a hosted site + universal/app links configured, use https so the
 * link works for people who don't have the app yet; otherwise fall back to the app scheme.
 */
export function inviteLink(code: string) {
  const base = process.env.EXPO_PUBLIC_INVITE_BASE_URL ?? `${appScheme}://invite/`;
  return `${base}${code}`;
}
