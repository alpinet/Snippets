// Uptime check for monitors (UptimeRobot, Better Stack…): 200 when the API and database respond.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const started = Date.now();
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data, error } = await sb.rpc('health');
  const body = { ok: !error, db: error ? error.message : data, latency_ms: Date.now() - started };
  return new Response(JSON.stringify(body), {
    status: error ? 503 : 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
