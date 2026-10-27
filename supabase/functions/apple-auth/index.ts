// Called right after native Sign in with Apple: trade the one-time authorization code for a
// refresh token and keep it server-side, so account deletion can revoke it with Apple.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { appleConfigured, exchangeCode } from '../_shared/apple.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appleConfigured()) return new Response(JSON.stringify({ ok: false, reason: 'not configured' }), { status: 200 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { code, clientId } = await req.json().catch(() => ({}));
  if (typeof code !== 'string' || typeof clientId !== 'string') return new Response('Bad request', { status: 400 });

  const token = await exchangeCode(clientId, code);
  if (!token) return new Response(JSON.stringify({ ok: false }), { status: 200 });

  await admin.from('auth_secrets').upsert({
    user_id: user.id,
    apple_refresh_token: token,
    apple_client_id: clientId,
    updated_at: new Date().toISOString(),
  });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
