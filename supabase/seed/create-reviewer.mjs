// Creates an App Review demo account with two friends and a shared week of moments.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
//   REVIEWER_PASSWORD='choose-a-strong-one' node supabase/seed/create-reviewer.mjs
//
// Everything goes through the normal signed-in API (so every server rule applies), except
// marking last week as "shared", which normally only happens on a Sunday.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, REVIEWER_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !REVIEWER_PASSWORD) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and REVIEWER_PASSWORD.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PEOPLE = [
  { email: 'appreview@snippets.app', username: 'appreview', name: 'Avery (App Review)' },
  { email: 'sarah.demo@snippets.app', username: 'sarah_demo', name: 'Sarah' },
  { email: 'mike.demo@snippets.app', username: 'mike_demo', name: 'Mike' },
];
const MOMENTS = {
  appreview: [[0, 'Finally tried that ramen place', 'Worth the wait — rich broth.', 1060], [3, 'Early morning walk', 'Quiet and crisp outside.', 1018]],
  sarah_demo: [[1, 'Philly day trip', 'Didn’t really have a plan. Just walked around all day.', 1039], [5, 'Rooftop sunset', '', 1036]],
  mike_demo: [[2, 'Basketball was rough', 'We lost by 20 but still had a great time.', 1047], [4, 'Finished reading chapter 4', 'Slow progress but good.', 1074]],
};

const monday = (d) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
};
const iso = (d) => d.toISOString().slice(0, 10);
const lastWeek = monday(new Date());
lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
const addDays = (n) => {
  const d = new Date(lastWeek);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

async function ensureUser(p) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === p.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email: p.email, password: REVIEWER_PASSWORD, email_confirm: true });
    if (error) throw error;
    user = data.user;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: REVIEWER_PASSWORD });
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: p.email, password: REVIEWER_PASSWORD });
  if (error) throw error;
  await client.from('profiles').update({ username: p.username, display_name: p.name }).eq('id', user.id);
  return { ...p, id: user.id, client };
}

const people = [];
for (const p of PEOPLE) people.push(await ensureUser(p));
const [reviewer, ...friends] = people;

for (const f of friends) {
  await reviewer.client.rpc('send_friend_request', { target: f.id });
  await f.client.rpc('send_friend_request', { target: reviewer.id }); // accepts the pending request
}
await friends[0].client.rpc('send_friend_request', { target: friends[1].id });
await friends[1].client.rpc('send_friend_request', { target: friends[0].id });

for (const person of people) {
  const { count } = await admin.from('snippets').select('id', { count: 'exact', head: true })
    .eq('user_id', person.id).eq('week_start', iso(lastWeek));
  if (count) continue; // already seeded
  for (const [day, title, reflection, photo] of MOMENTS[person.username]) {
    const id = randomUUID();
    const { error } = await person.client.from('snippets').insert({
      id, user_id: person.id, week_start: iso(lastWeek), happened_on: addDays(day), title, reflection,
    });
    if (error) throw error;
    const bytes = await (await fetch(`https://picsum.photos/id/${photo}/1200/1500`)).arrayBuffer();
    const thumb = await (await fetch(`https://picsum.photos/id/${photo}/480/600`)).arrayBuffer();
    const mediaId = randomUUID();
    const path = `${person.id}/${id}/${mediaId}.jpg`;
    const thumbPath = `${person.id}/${id}/${mediaId}-thumb.jpg`;
    await person.client.storage.from('media').upload(path, bytes, { contentType: 'image/jpeg' });
    await person.client.storage.from('media').upload(thumbPath, thumb, { contentType: 'image/jpeg' });
    const { error: mErr } = await person.client.from('media').insert({
      id: mediaId, snippet_id: id, user_id: person.id, kind: 'image', path, thumb_path: thumbPath,
      width: 1200, height: 1500, position: 0,
    });
    if (mErr) throw mErr;
  }
}

// The one privileged step: everyone "shared" last week, so it's unlocked for the reviewer.
await admin.from('weeks').update({ status: 'published', published_at: new Date().toISOString() })
  .in('user_id', people.map((p) => p.id)).eq('week_start', iso(lastWeek));

await friends[0].client.from('comments').insert({
  snippet_id: (await admin.from('snippets').select('id').eq('user_id', reviewer.id).limit(1).single()).data.id,
  body: 'This looks so good — take me next time!',
});

console.log(`Done. Reviewer login: ${reviewer.email} / (your REVIEWER_PASSWORD)`);
console.log(`Last week (${iso(lastWeek)}) is shared and unlocked; this week is open for drafting.`);
