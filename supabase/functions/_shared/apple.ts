// Sign in with Apple server calls: exchange an authorization code for a refresh token,
// and revoke it on account deletion (required by App Store Guideline 5.1.1(v)).
import { importPKCS8, SignJWT } from 'npm:jose@5';

const APPLE = 'https://appleid.apple.com';

async function clientSecret(clientId: string): Promise<string> {
  const key = await importPKCS8(Deno.env.get('APPLE_PRIVATE_KEY')!.replace(/\\n/g, '\n'), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: Deno.env.get('APPLE_KEY_ID')! })
    .setIssuer(Deno.env.get('APPLE_TEAM_ID')!)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience(APPLE)
    .setSubject(clientId)
    .sign(key);
}

export function appleConfigured(): boolean {
  return !!(Deno.env.get('APPLE_PRIVATE_KEY') && Deno.env.get('APPLE_KEY_ID') && Deno.env.get('APPLE_TEAM_ID'));
}

export async function exchangeCode(clientId: string, code: string): Promise<string | null> {
  const res = await fetch(`${APPLE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: await clientSecret(clientId),
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return typeof json.refresh_token === 'string' ? json.refresh_token : null;
}

export async function revoke(clientId: string, refreshToken: string): Promise<boolean> {
  const res = await fetch(`${APPLE}/auth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: await clientSecret(clientId),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }),
  });
  return res.ok;
}
