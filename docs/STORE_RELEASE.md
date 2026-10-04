# Shipping Snippets to the App Store and Google Play

These steps need your accounts and credentials. Everything in the code is already set up for them.

## 0. Accounts you need
- **Apple Developer Program:** $99/year, https://developer.apple.com/programs/
- **Google Play Console:** $25 one-time, https://play.google.com/console
- **Supabase:** free tier is fine to start, https://supabase.com
- **Expo:** free, https://expo.dev

## 1. Pick final identifiers
In `app.json`, replace the placeholder `com.snippets.app` in both `ios.bundleIdentifier` and `android.package` with an ID you own, such as `com.yourname.snippets`. Once you've published, these can't change.

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

## 4. Public pages (required by both stores)
Host `docs/privacy-policy.md`, `docs/terms.md` and a simple support page (just an email is fine) at your `EXPO_PUBLIC_SITE_URL`. Both stores ask for the privacy URL.

**Optional but recommended:** make invite links work before the app is installed.
1. Host `https://<site>/invite/<code>` with a redirect to the stores.
2. Add iOS Associated Domains and Android App Links (https://docs.expo.dev/linking/overview/).
3. Set `EXPO_PUBLIC_INVITE_BASE_URL=https://<site>/invite/`.

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

## Known gaps to close before a public launch
- **Apple token revocation on account deletion:** Apple asks apps that use Sign in with Apple to revoke tokens. Add a call to `https://appleid.apple.com/auth/revoke` in the `delete-account` function, using the stored Apple refresh token.
- **Server-side video transcoding:** today the device exports 720p H.264 before upload, which keeps files small. A server pipeline would guarantee it.
