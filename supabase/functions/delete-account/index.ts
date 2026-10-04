// Permanently deletes the calling user's account, media and data.
// Required by App Store Guideline 5.1.1(v) and Google Play's account deletion policy.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Called only by the mobile app, so no CORS headers: browsers can't call it cross-origin.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  // Remove every stored object under the user's folder in each bucket.
  for (const bucket of ['media', 'avatars']) {
    const queue = [user.id];
    while (queue.length) {
      const prefix = queue.pop()!;
      const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      const files: string[] = [];
      for (const e of entries ?? []) {
        if (e.id) files.push(`${prefix}/${e.name}`);
        else queue.push(`${prefix}/${e.name}`); // folder
      }
      if (files.length) await admin.storage.from(bucket).remove(files);
    }
  }

  // Cascades to profiles, weeks, snippets, media rows, reactions, comments, friendships.
  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) return new Response(delError.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
