# Shipping Snippets to the App Store and Google Play

These steps need your accounts and credentials. Everything in the code is already set up for them.

## 0. Accounts you need
- **Apple Developer Program:** $99/year, https://developer.apple.com/programs/
- **Google Play Console:** $25 one-time, https://play.google.com/console
- **Supabase:** free tier is fine to start, https://supabase.com
- **Expo:** free, https://expo.dev

## 1. Pick final identifiers
- **Bundle ID:** in `app.config.ts`, change `BUNDLE_ID` (now the placeholder `com.snippets.app`) to an ID you own, such as `com.yourname.snippets`. Dev and beta builds add `.dev` / `.beta` automatically. Once you've published, it can't change.
- **Store name:** App Store names must be unique, and "Snippets" alone is very likely taken. Check App Store Connect when you create the app, and have a fallback ready, such as "Snippets: Weekly Scrapbook" or "Snippets — Friends' Weeks". The name on the home screen can stay "Snippets".
- **Domain:** you'll host the privacy policy, terms, support page and invite links on it. Set it as `EXPO_PUBLIC_SITE_URL` in each EAS environment.

## 2. Backend (Supabase)
1. Create a project. Note the **Project URL** and **anon key** (Settings → API).
2. Apply the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```
3. **Database → Extensions:** enable `pg_net` and `pg_cron`. Then, in the SQL editor:
   ```sql
   select cron.schedule('sunday-reminders', '0 * * * *', 'select public.send_sunday_reminders()');
   ```
4. Deploy the account-deletion function:
   ```bash
   npx supabase functions deploy delete-account
   ```
5. **Auth → URL Configuration:** add `snippets://auth-callback` to the redirect URLs.
6. **Auth → Providers:**
   - **Apple:**
     - Create a Services ID and a Sign in with Apple key in the Apple Developer portal.
     - Enter the Services ID, Team ID, Key ID and the .p8 key in Supabase.
     - Add your iOS bundle ID to "Client IDs" so native sign-in works.
   - **Google:**
     - Create an OAuth client (type "Web application") in Google Cloud Console.
     - Its authorized redirect URI is `https://<ref>.supabase.co/auth/v1/callback`.
     - Paste the client ID and secret into Supabase.
   - **Email:** keep "Confirm email" on for production.

## 3. App configuration (EAS)
```bash
npm install -g eas-cli      # or use: npx eas-cli@latest
eas login
eas init                    # links the project and writes extra.eas.projectId (needed for push)
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --environment production --environment preview
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --environment production --environment preview
eas env:create --name EXPO_PUBLIC_SITE_URL --value https://<your site> --environment production --environment preview
```

**Push notifications:**
- iOS: EAS creates the APNs key during the first build.
- Android: add FCM V1 credentials with `eas credentials`, under Android → Google Service Account → FCM V1.

## 4. Public site: legal pages and invite links
`site/` is a ready-made static site. Host it free on Netlify, Cloudflare Pages or Vercel; redirect and header files for each are included.
1. Fill in `site/config.js`: the Supabase URL and anon key (both public), plus your store links.
2. In `site/.well-known/apple-app-site-association`, put `YOUR_TEAM_ID.<bundle id>`. In `assetlinks.json`, put your package name and the SHA-256 of the Play app-signing key (Play Console → App integrity).
3. Fill in the placeholders in `docs/privacy-policy.md` and `docs/terms.md`, then run `node site/build.mjs` to regenerate the pages. Put your email in `site/support.html`.
4. Deploy. Check that `https://<site>/.well-known/apple-app-site-association` is served as JSON.
5. Set `EXPO_PUBLIC_INVITE_BASE_URL=https://<site>/invite/` in EAS. Invite links then open the app when it's installed, and the landing page ("Alex invited you…", with the code and store buttons) when it isn't. New users can paste the code in onboarding.

## 5. Build and test
**Local builds need Xcode 26.4 or newer** (Expo SDK 57's minimum). EAS cloud builds already use a current Xcode.
```bash
eas build --profile preview --platform all      # installable test builds
eas build --profile production --platform all
```
Test on real devices through TestFlight (iOS) and the Play internal testing track (Android) with a few friends for at least one Sunday.

## 6. Submit
```bash
eas submit --platform ios
eas submit --platform android
```

### App Store Connect checklist
- **Category:** Social Networking. **Age rating:** 12+, because users can share user-generated content with friends.
- **App Privacy** answers. They match `ios.privacyManifests` in `app.json`:
  - Data collected: Photos or Videos, Email Address, Name, Other User Content.
  - It's all linked to the user, used for app functionality only, and never used for tracking.
- **Sign in with Apple:** included, as required because Google sign-in is offered (Guideline 4.8).
- **Account deletion:** Profile → Delete account (Guideline 5.1.1(v)).
- **User-generated content (Guideline 1.2):**
  - Content is visible only to mutual friends.
  - Users can **report** moments, comments and people: the ··· menu on a moment, long-press on a comment, or a friend's page. Reports land in the `public.reports` table.
  - Users can **block**. Blocking ends the friendship, hides the blocked person's comments and prevents re-adding.
  - Users can remove friends and delete comments on their own moments.
  - **You must review reports within 24 hours.** Use Supabase → Table editor → `reports`, and set `resolved_at` when handled. Consider a database webhook that emails you on insert.
- **Review notes:** give the reviewer a demo email/password account that already has 2–3 friends with content. Explain that sharing opens on Sundays and that friends' weeks unlock after you share.

### Google Play checklist
- **Data safety form:** photos/videos, email, name and user content; collected, not shared; encrypted in transit; users can request deletion.
- **Account deletion URL:** Play requires a web link as well. Point it at a support page that explains in-app deletion or offers an email request.
- **Content rating questionnaire:** users can interact and share content.
- New personal developer accounts must run a **closed test with 12+ testers for 14 days** before production access.

## App Review demo account
Reviewers need a login that already has friends and a shared week:
```bash
SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… REVIEWER_PASSWORD='…' \
  node supabase/seed/create-reviewer.mjs
```
Paste `appreview@snippets.app` and the password into App Store Connect → App Review Information (and Play Console → App access). Re-run it the week of each submission so "last week" is fresh.

## Pre-submission checklist (things only a real build can prove)
- [ ] Sign in with Apple on a device. Then delete the account and confirm the app is gone from Settings → Apple ID → Sign in with Apple. This needs the `APPLE_*` secrets set on the `apple-auth` and `delete-account` functions; see OPERATIONS.
- [ ] Google sign-in and email sign-up (with confirmation email) on iOS and Android.
- [ ] Push notifications: a nudge, a reply, "friend shared", and the Sunday reminder (6 pm local) arrive on a real device.
- [ ] An invite link opens the installed app; on a phone without the app it shows the landing page.
- [ ] Upload a 15-second video and three photos on cellular. Turn on airplane mode mid-session and check the offline strip.
- [ ] Export the PDF scrapbook and share a recap image.
- [ ] Moderation: report something and confirm the webhook message arrives.

## Known gaps to close before a public launch
- **Server-side video transcoding:** today the device exports 720p H.264 before upload, which keeps files small. A server pipeline would guarantee it.
