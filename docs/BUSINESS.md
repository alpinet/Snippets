# Snippets — business notes

Money plan: **decide later**. Ship free, learn whether friend groups make it a weekly habit, and keep every path open. These notes are the groundwork for that decision.

## What success looks like first (before money)
Measured from our own database. The views are in `analytics.*`; see `docs/OPERATIONS.md` → Analytics.

| Metric | Why it matters | Rough "it's working" bar |
|---|---|---|
| Weekly participation | People actually do the ritual | ≥ 50% of accounts save a moment weekly |
| Reciprocal sharing | Friend groups, not lone users | ≥ 60% of sharers have a friend who shared too |
| Cohort retention (week 4, week 8) | It sticks after the novelty | ≥ 35% still sharing in week 8 |
| Archive depth | The scrapbook is becoming valuable | Median 8+ weeks kept by month 3 |
| View-after-share | The swap is the reward | ≥ 80% look at friends after sharing |

These are the numbers an investor or acquirer asks for first. Keep them honest.

## Running costs (rough)
Assumptions per active person per week:
- 2 moments, about 1.5 photos each;
- full image about 350 KB, thumbnail about 40 KB;
- an occasional short video (about 3–5 MB);
- each moment viewed by about 4 friends.

That works out to about **2 MB of new storage per person per week** (~100 MB a year).

| Weekly active people | Storage added / year | Media egress / month | Supabase |
|---|---|---|---|
| 1,000 | ~100 GB | ~20 GB | Pro ($25/mo) covers it |
| 10,000 | ~1 TB | ~200 GB | ~$25 + ~$20 storage/mo |
| 50,000 | ~5 TB | ~1 TB | ~$25 + ~$105 storage + ~$70 egress/mo |

Without image thumbnails, list views would load full images, using **5–8× more egress**. Thumbnails shipped in this round.

Push notifications (Expo) and auth are free at these sizes. Apple and Google take 15% of in-app purchases under the small-business programs.

## Ways to make money (to test later, in this order)
1. **Printed scrapbooks.** This is the most on-brand option: "Your 2026 in Snippets" or a season, printed.
   - The PDF export in Profile is already the prototype. A print-on-demand API (Lulu, Peecho, Printful photo books) costs about $12–20 per book, which can sell for $29–39.
   - It's a one-off, giftable, seasonal purchase (December!). It also doesn't change the free experience.
2. **Snippets+ subscription** (about $2.99/mo or $24.99/yr) for extras only:
   - year-in-review designs;
   - higher-quality and longer video;
   - unlimited export;
   - custom card themes.

   The core ritual, friends and the archive stay free forever.
3. **Grow, then sell or raise.** This only works with strong retention and reciprocity numbers (above). Acquirers buy engaged networks, not downloads.

## Never
- Ads or sponsored content.
- Selling or sharing data, or third-party tracking SDKs.
- Paywalling the weekly ritual, friends, or access to your own archive.
- Engagement tricks: streaks, daily notifications, public counts.

These are the product's promise, and the reason people will trust it with their life.

## Before taking money
- **A company.** Form an LLC, or the equivalent where you live, and get a business bank account.
- **Store programs.** Join the App Store Small Business Program and accept Google Play's 15% tier.
- **Payments.** When you pick a path, use RevenueCat for subscriptions (handles both stores) or Stripe for print orders. Physical goods must use outside payment, not in-app purchase.
- **Legal review.** Update the privacy policy and terms for purchases, and have a lawyer review them.
