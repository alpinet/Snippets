# Operating Snippets

How Snippets is run, deployed and monitored. Keep this current: if you change how something works, update it here.

## Environments

| | Development | Staging | Production |
|---|---|---|---|
| App build | `eas build --profile development` / Expo Go | `preview` profile | `production` profile |
| App name / ID | Snippets Dev / `com.snippets.app.dev` | Snippets Beta / `…app.beta` | Snippets / `com.snippets.app` |
| URL scheme | `snippets-dev://` | `snippets-beta://` | `snippets://` |
| Backend | local `npx supabase start`, or demo mode | **separate** Supabase project | **separate** Supabase project |
| EAS environment | `development` | `preview` | `production` |
| GitHub Environment | — | `staging` | `production` |

All three variants can be installed on one phone. Staging should mirror production: same migrations and the same edge functions, deployed by the same workflow.

## Secrets: where each one lives

Nothing secret is committed. `.env` is gitignored; `.env.example` lists the names.

| Secret | Lives in | Notes |
|---|---|---|
| Supabase URL + **anon** key | EAS env vars (per environment) | Public by design; RLS is what protects data |
| Supabase **service role** key | Supabase edge function env only (automatic) | Never in the app, never in CI logs |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | GitHub Environment secrets (per env) | Used by `deploy.yml` |
| `EXPO_TOKEN` | GitHub Environment secrets | Lets CI run EAS builds |
| `EXPO_PUBLIC_SENTRY_DSN` | EAS env vars | Different Sentry environment tag per variant |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | EAS env vars, *sensitive* visibility | Source-map upload; dev builds skip it |
| Apple / Google OAuth secrets | Supabase dashboard → Auth → Providers | Separate clients for staging and prod |

Use **different keys per environment**. Never copy a production key into staging.

## Deploying

Deploys run from GitHub Actions, never from a laptop.

1. Open a PR. **CI** (`.github/workflows/ci.yml`) runs lint, typecheck and unit tests. It also starts a real Supabase in Docker, applies every migration from scratch and runs `supabase/tests`.
2. Merge to `main`.
3. Actions → **Deploy** → `staging`, ticking "build app" if needed. This pushes migrations and edge functions, then makes an installable EAS preview build.
4. Check it on the staging build.
5. Actions → **Deploy** → `production`. This pushes migrations and functions, then builds and auto-submits to TestFlight and Google Play internal testing. Promote the release in App Store Connect / Play Console.

**Database changes** always go in a new file in `supabase/migrations/`. Never edit a migration that has already been deployed.

## Observability

- **Crashes and errors:** Sentry, switched on when `EXPO_PUBLIC_SENTRY_DSN` is set. It reports:
  - render crashes, via the root `ErrorBoundary`;
  - every failed query or mutation, tagged with the query key;
  - native crashes.

  Only the opaque user id is attached. No names, emails, photos or text.
- **Server logs:** Supabase dashboard → Logs (API, Postgres, Auth, edge functions).
- **Health check:** `GET https://<ref>.supabase.co/functions/v1/health` returns 200 `{ ok: true }` when the API and database respond. Point an uptime monitor at it (UptimeRobot or Better Stack free tier).
- **Push delivery:** Expo receipts in Supabase → `net._http_response` (pg_net responses).

## Abuse limits

Server-side, in `20261002000000_hardening.sql` and `config.toml`:

| What | Limit |
|---|---|
| Comments | 30 per 10 minutes per user |
| Friend requests | 30 per day |
| Reports | 20 per day |
| Moments | 3 per week; 3 media each; videos ≤ 15 s |
| Storage | Uploads only into your own moments; at most 6 files per moment, 3 avatars |
| Auth | Per-IP limits on sign-ups, sign-ins and emails. Mirror these in Dashboard → Auth → Rate Limits |

## Moderation

Reports land in `public.reports`. Check them daily (App Store Guideline 1.2 expects action within 24 hours). Remove offending content in the Table editor and set `resolved_at`. Consider a Database Webhook on insert that emails you.

## Backups: test a restore before you need one

- **Free plan:** daily backups, but you can't restore them yourself. Upgrade to Pro before launch for daily backups plus optional point-in-time recovery.
- **Once before launch:**
  1. Restore a production backup into a scratch project.
  2. Run `supabase test db` against it.
  3. Open the staging app pointed at it.
  4. Write down how long it took.
- **Storage objects (photos) aren't in database backups.** Pro includes storage. Otherwise schedule a periodic copy of the `media` bucket.

## Time

- Timestamps (`created_at`, `published_at`…) are `timestamptz`: stored in UTC and shown in local time.
- Weeks are deliberately **calendar dates** (`date`, Monday start) in each person's own timezone. "Sunday" means *their* Sunday.
- The server works out "today" from `user_private.timezone`, which the app syncs on launch.
