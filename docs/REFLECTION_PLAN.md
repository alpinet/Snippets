# Snippets, reflection first

*Plan, Oct 27, 2026. This plan changes several of the spec's "non-negotiable" mechanics (BRIEF.md says to ask before deviating), so the open questions at the end need answers before Phase 2.*

## The repositioning in one line

> **Snippets is a weekly reflection journal for the moments that mattered to you. Because you're already doing that, sharing a few of them with close friends takes one tap.**

Today the spec says the opposite. §34 calls it "fundamentally a network ritual, not an individual content-creation tool", and §2.1's guiding question is *"What happened this week that I want my friends to know about?"* The visual design already reads as a journal. The **mechanics and the words** are what point at friends.

---

## 1. What other apps leave out

| App | What it's built for | Why it fails as a reflection tool |
|---|---|---|
| **Instagram** | Presenting yourself to an audience | Captions are written for viewers, not for you. The archive is an afterthought. "On This Day" resurfaces a post mainly so you'll **re-share** it as a Story, so a memory becomes content again. |
| **TikTok** | Entertainment, reach | Optimized for watch time. Your own history is a grid of views and likes; there's nowhere to record why something mattered. |
| **Snapchat Memories** | Storing everything you snapped | Volume, not meaning. Since late 2025 free storage is capped at 5 GB, with paid tiers above that, so your past is something you rent. |
| **BeReal** | Daily, in-the-moment authenticity | The point is *now*. There's no reflection afterwards, and the daily cadence is pressure. |
| **Retro** *(closest competitor: weekly, friends-only, camera roll, ~1.7M monthly users)* | Seeing friends' weeks | Social-first: you unlock friends' recent weeks by sharing yours, and the text is a caption. **Snippets as built today is close to Retro.** |
| **Apple Journal / Day One** | Private writing | Good reflection prompts, but they're text-first, daily-journal shaped (blank-page guilt), and completely solitary. They have no gentle reason to come back each week. |
| **Apple / Google Photos "Memories"** | Algorithmic recaps of everything | Chosen by a model, not by you. They know *what* is in a photo, never *why* it mattered. |

### The gaps Snippets can own

1. **No one records why a moment mattered while it's still fresh.** Photos keep the *what*; the meaning fades in weeks. → The reflection is the core of a moment, not a caption.
2. **Looking back is passive and algorithmic.** → Looking back should be a ritual you author: a weekly close, a month, a year.
3. **No sense of what you've accomplished or how you've changed.** "What did I actually do this year?" has no answer on Instagram. → Lookback shows firsts, things you're proud of, and how you've grown.
4. **Small moments get drowned out.** Feeds reward the impressive. → Small joys get the same weight as big events, and there are no counts to compete on.
5. **An audience changes what you write.** → Private by default. You write for yourself and share by choice.
6. **Your past is held by a platform.** → "Your archive is yours": export already exists (PDF). Feature it.

---

## 2. Principles (these replace spec §2.1 and §34's framing)

1. **A moment is complete when you keep it, not when you share it.**
2. **Write for yourself; share by choice.** Nothing you write is seen by anyone unless you choose to share it.
3. **The archive is the product.** Each week makes the past more valuable.
4. **Friends are the warmth, not the point.** A solo user gets the full product; friends add closeness on top.
5. **Keep the calm weekly rhythm.** Sunday stays the ritual, but it means *look back on your week*, not *post your week*.

---

## 3. Where the app is social-first today (audit)

| # | Today | Where | Why it matters |
|---|---|---|---|
| A1 | Visibility is per **week**: sharing shares every moment and its reflection | `weeks.status`, `can_view_week()`, init migration | You can't keep one moment for yourself, so every reflection is written with friends watching. |
| A2 | The prompt "What would you tell a friend about this?" | `src/app/snippet/edit.tsx` `PROMPTS` | Tells you to write for an audience. |
| A3 | Home opens with a countdown: "Check-in opens Sunday · in 3d 4h", and on Sunday "6h 12m left" | `CheckInBanner` in `src/app/(tabs)/index.tsx` | The first thing you see is a deadline for posting. |
| A4 | Sunday's only big button is **"Share your week"**; afterwards the app jumps to Friends | Home `PrimaryButton`, `publish.onSuccess → /friends` | The week's climax is sharing, and the reward is other people's content. |
| A5 | "Drafts stay private until you share them on Sunday." | Home footnote | Treats an unshared moment as unfinished. |
| A6 | Onboarding asks "What should friends call you?" and then "Who do you want to swap weeks with?" | `(onboarding)/` | The first impression is a social network. |
| A7 | Lookback week cards show "· 2 replies" | `lookback.tsx:199` | A social metric on your personal archive. |
| A8 | Tab order: Home · **Friends** · Lookback · Profile | `(tabs)/_layout.tsx` | Friends ranks above your own history. |
| A9 | Copy: "Share on Sunday. See theirs.", "Weeks are better with a few more people.", "Share your week to see theirs." | various | The value promise is other people's weeks. |
| A10 | Accent colour (terracotta) marks the Share button and the countdown | theme usage | The strongest colour points at sharing. |
| A11 | Success metrics are friend-group participation and reciprocity | spec §34, `analytics` views | The team would end up optimizing the wrong thing. |

---

## 4. The plan

### Phase 1: Words, order, feel (no schema change, ~1–2 days)

1. **Copy pass.** Main replacements:

   | Now | Becomes |
   |---|---|
   | Share your week (button) | Look back on your week |
   | Check-in opens Sunday · in 3d 4h | *(remove the countdown)* → "On Sunday, take a minute to look back." |
   | Drafts stay private until you share them on Sunday. | Your moments are yours. Share any of them on Sunday, or none. |
   | What should friends call you? | What should we call you? |
   | Share on Sunday. See theirs. | Keep the moments that mattered. |
   | Weeks are better with a few more people. | Want to share a few moments with close friends? *(optional)* |
   | Share your week to see theirs. *(Friends tab, locked)* | Share a moment from your week to see theirs. |
   | Sunday reminder push | "Take a minute to look back on your week." |

   Stop calling unshared moments "drafts". A saved moment is **kept**.
2. **Prompts.** Remove "What would you tell a friend about this?". Add prompts for appreciation, accomplishment and change, for example "What did you appreciate about this?", "What did it take to get here?", "What was new for you?", "What do you want future you to remember?".
3. **Tab order:** This week · **Lookback** · Friends · Profile. Rename the Home tab "This week".
4. **Remove social counts from personal views:** take "replies" off Lookback cards (A7). On a moment's own screen, put the reflection first and fold reactions and comments under a quiet "From friends" section.
5. **Visual feel:**
   - Set reflection text in a serif (iOS "New York" via `ui-serif`, `serif` on Android) so your own words read like a journal. Everything else stays in the system font.
   - Re-point the terracotta accent from sharing to reflecting: the prompt card, today's day marker, Lookback badges. The Friends tab uses neutral ink.
   - Keep the existing palette. The "whisper-quiet warmth" tokens already fit; this is about *where* emphasis goes.
6. **Onboarding solo-first.** After sign-in: name → **"What's one moment from this week you want to keep?"** (create the first moment) → *then* an optional friends step whose "Later" button is as visible as "Invite". Someone with no friends on the app should still understand its value in under a minute.

### Phase 2: Private by default, close the week (schema + RLS, ~3–5 days)

7. **Visibility per moment.** Add `snippets.shared boolean not null default false`, in a **new** migration (OPERATIONS.md: don't edit migrations once deployed).
   - Friends can read a moment only if `can_view_week(...) and shared`.
   - Storage reads follow the same rule.
   - Add pgTAP tests: unshared moments are invisible to friends even after the week is published.
8. **Reflections private even on shared moments.** Move reflection text into an owner-only table (`snippet_notes`, RLS = owner). Sharing a moment shares its photos and title; a separate per-moment toggle, **"Include my reflection"**, defaults to off. Friends never see words you didn't choose to show them.
9. **Sunday becomes "Close your week"** (replaces Share your week):
   1. Look over the week's moments on the timeline.
   2. Answer **one private weekly question** ("What will you remember about this week?"), one line, optional. It's stored per week, owner-only.
   3. **Optionally** pick which moments to share (checkboxes, none pre-selected), plus whether to include each reflection.
   4. Finish with "Week kept." If friends have shared, show a quiet card ("Sarah and Mike shared their weeks"). No automatic jump to Friends.
10. **Post-to-unlock stays, re-based on sharing.** Friends' weeks unlock when you've shared **at least one** moment that Sunday. A week you kept without sharing doesn't unlock anything, which is fair and keeps reciprocity. `publish_week()` becomes `close_week(shared_ids[])`. A closed week with nothing shared is valid and counts as **kept**.
11. **Update both API implementations** (`lib/api/supabase.ts`, `lib/api/demo.ts`), the demo seed data (some private moments and some weekly lines), and the unit tests.

### Phase 3: Lookback as the heart of the app (~1–2 weeks)

12. **Optional moment kinds:** *Small joy · First time · Proud of · Hard but worth it · People*. Each pre-selects a matching prompt and lets Lookback show threads: "Your firsts this year (14)", "Things you were proud of".
13. **"Looking back" notes:** on any past moment, add a dated note from the present ("A year later, I still think about this"). Resurfacing cards ("Around this time last month / last year", "Random memory") ask *"Looking back, what do you notice?"* instead of only showing photos. **No mainstream app lets you add reflection on top of reflection over time.**
14. **Weekly lines on the timeline:** each Lookback week card shows your one-line answer from step 9, so scrolling becomes reading your own diary.
15. **Month and year rituals:** on the last Sunday of a month, "Which moment stood out this month?" (pick one). In December, "Your year in moments": your 12 monthly picks, your firsts, your proud-ofs, as a printable/exportable recap. It extends the existing `recap.tsx` and `exportArchive.ts`. There are no scores, streaks or totals to beat.

### Phase 4: Make it true everywhere (~1–2 days)

16. **Metrics:** primary is **weeks kept per active user** and Lookback revisits. Sharing and reciprocity become secondary. Add `week_kept`, `lookback_note_added` and `moment_shared` events, plus matching `analytics.*` views.
17. **Docs:** rewrite spec §1, §2.1, §4, §18, §34 and §37 (the one-paragraph definition), the BRIEF tagline/philosophy, and the README.
18. **Store listing:** move from Social Networking to **Lifestyle**. Lead the description with reflection and memory; friends come second. Keywords: journal, reflection, memories, gratitude, weekly.
19. **Profile:** add a "Your archive is yours" section with export, as a contrast to platforms that rent your past back to you.

---

## 5. Decisions (Oct 27, 2026)

These override the matching parts of sections 4.7–4.10 above.

1. **No default visibility.** Every moment must be explicitly marked **"Just for me"** or **"Share with friends"** before it can be kept. The editor pre-selects neither, and the choice can be changed later.
2. **Keep the cap of 3**, framed as "the 3 that mattered".
3. **Unlock = keep your week.** To see friends' moments for a week, you close your own week that Sunday with at least one moment, whether private or shared. You then see only the moments friends chose to **share**; private moments are never visible to anyone else. Backfilled weeks still never unlock anything.
4. **Serif** (iOS New York / Android serif) for reflection text.

Deferred for now: the separate "Include my reflection" toggle (4.8). A shared moment shares its title, photos and reflection together.

## 6. What stays the same

Weekly rhythm, Sunday ritual, mutual friends only, no algorithm, no public profiles, no like counts, no streaks, quiet nudges, backfill, server-side media, and the warm journal visual system. Those already fit a reflection app. They were just pointed at the wrong goal.

---

*Sources for the competitor notes:*
[Snapchat 5 GB Memories cap (TechCrunch)](https://techcrunch.com/2025/09/29/snapchat-caps-free-memory-storage-launches-paid-storage-plans) ·
[Retro, photo sharing with friends (Fast Company)](https://www.fastcompany.com/91462432/retro-photo-sharing-app) ·
[Retro on the App Store](https://apps.apple.com/app/id6443709020) ·
[Retro recaps (TechCrunch)](https://techcrunch.com/2023/12/07/retro-lets-you-create-recaps-of-your-most-memorable-photos-and-send-the-best-ones-as-postcards) ·
[Apple Journal in iOS 26 (9to5Mac)](https://9to5mac.com/2025/06/17/apples-journal-app-is-coming-to-ipad-and-mac-with-big-upgrades/) ·
[Apple Journal launch (Apple Newsroom)](https://apple.com/au/newsroom/2023/12/apple-launches-journal-app-a-new-app-for-reflecting-on-everyday-moments) ·
[Facebook Memories page](https://www.lindseygamble.com/blog/facebook-launches-memories-page-to-make-it-easier-for-you-to-find-past-moments)
