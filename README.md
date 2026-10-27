# Snippets

*A few moments from your week.*

A private weekly photo scrapbook for small circles of mutual friends. It's built from `../BRIEF.md`, `../spec.md` and `../mockups/`.

- **App:** Expo SDK 57 with React Native, Expo Router and TypeScript. One codebase for iOS and Android.
- **Backend:** Supabase: Postgres + row-level security, private Storage, Auth (Apple, Google, email) and Expo push notifications.

## Run it

```bash
npm install
npx expo run:ios        # or: npx expo run:android  (local iOS builds need Xcode 26.4+)
npx expo start --go     # quickest look: runs in Expo Go, no native build needed
```

With no Supabase environment variables set, the app runs in **demo mode**. It uses a local, seeded backend with friends Sarah, Mike, Jess and Priya, plus about five months of archive, so every screen is usable offline.

- Sign in with any method.
- **Profile → Demo mode → "Pretend it's Sunday"** unlocks the Sunday share-and-unlock ritual.

For QA screenshots, `EXPO_PUBLIC_DEMO_AUTOLOGIN=1` starts the demo signed in, and `EXPO_PUBLIC_DEMO_SUNDAY=1` starts it on Sunday. Both flags only affect demo mode.

To use a real backend, copy `.env.example` to `.env` and fill in the Supabase URL and anon key. See `docs/STORE_RELEASE.md`.

```bash
npm test          # week math + business-rule tests (demo backend)
npm run lint
npm run typecheck
```

For database rule tests: `npx supabase start`, then `npx supabase test db`. This needs Docker.

## Where the rules live

| Rule | Server (source of truth) | Client |
|---|---|---|
| 3 moments/week, 1–3 media each, video ≤ 15s | triggers in `supabase/migrations/*_init.sql` | editor + picker limits |
| Publish only on Sunday, local timezone | `publish_week()` checks `user_private.timezone` | Home shows Share only on Sunday |
| Post-to-unlock | `can_view_week()` used by every RLS policy + storage reads | Friends tab lock states |
| Backfill never unlocks friends | `can_view_week()` requires the viewer's week be `published`, not `backfilled` | — |
| One nudge per friend per week | `nudges` primary key + `nudge()` | "Nudged" state |
| Mutual friends only | `friendships` + RPCs | Friends manager, invite links |
| Report / block (App Store 1.2) | `reports`, `blocks`, `block_user()`; blocked users' comments hidden by RLS | ··· menu, comment long-press, friend page |
| Media stored server-side, compressed | private `media` bucket | `src/lib/media.ts` (1600px JPEG, 720p video) |

## Layout

```
src/app/                  routes (Expo Router)
  (auth)/                 welcome, sign-in
  (onboarding)/           profile setup, add friends
  (tabs)/                 Home · Friends · Lookback · Profile
  snippet/edit.tsx        create/edit a moment (modal)
  snippet/[id].tsx        full moment: media, reactions, comments
  week/[weekStart].tsx    one of my weeks (backfill entry point)
  friend/[id].tsx         a friend's shared history
  friends/manage.tsx      requests, search, invite link
  backfill.tsx            pick a past week
  invite/[code].tsx       snippets://invite/<code>
src/components/           UI kit (ui, media, social, …)
src/lib/api/              Api interface + Supabase and demo implementations
src/lib/week.ts           Mon–Sun week math in local time
src/theme.ts              design tokens ("whisper-quiet warmth")
supabase/                 migration, delete-account edge function, pgTAP tests
docs/                     store release guide, operations (envs, secrets, deploys, monitoring), privacy, terms
.github/workflows/         CI (app + database tests) and manual deploys
```
