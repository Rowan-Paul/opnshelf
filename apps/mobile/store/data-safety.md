# Data collection disclosures

Source of truth for **Apple App Privacy** ("nutrition labels", App Store Connect)
and **Google Play Data safety**. Derived from the published privacy policy at
https://opnshelf.xyz/privacy — keep all three in sync when any changes.

Authentication is delegated to the AT Protocol; **we never store passwords**.
We **do not sell** data and **do not** use data for cross-app tracking
(`ITSAppUsesNonExemptEncryption: false` and no IDFA/ad SDKs).

## What is collected

| Data | Category | Linked to user | Purpose | Source |
| --- | --- | --- | --- | --- |
| Handle, display name, avatar | Account info | Yes | App functionality | Provided by user (atproto account) |
| Shelf, watch history & dates | User content | Yes | App functionality | Provided by user |
| Star ratings, notes, reviews | User content | Yes | App functionality | Provided by user |
| Lists | User content | Yes | App functionality | Provided by user |
| Follow relationships | User content | Yes | App functionality | Provided by user |
| IP address, user agent (server logs) | Diagnostics | No | Security, abuse prevention | Automatic |
| Product analytics (PostHog, EU) | Analytics / product interaction | Yes | Analytics, improve the Service | Automatic |

## Apple App Privacy mapping
- **Data Used to Track You:** none.
- **Data Linked to You:** Contact Info (none — no email at signup), User Content
  (shelf, ratings, reviews, notes, lists), Identifiers (atproto DID/handle),
  Usage Data (PostHog product analytics).
- **Data Not Linked to You:** Diagnostics (server logs / crash & performance).

## Google Play Data safety mapping
- **Data shared with third parties:** none (PostHog is our processor, not a sale).
- **Data collected:**
  - Personal info → Name (display name), User IDs (handle/DID).
  - App activity → In-app actions, other user-generated content (shelf, reviews,
    ratings, notes, lists), App interactions (PostHog analytics).
  - App info & performance → Diagnostics (server logs).
- **Security practices:** data encrypted in transit; user can request deletion
  (atproto data lives in the user's own PDS and can be deleted there).

## Notes
- If analytics is disabled in a build (no `EXPO_PUBLIC_POSTHOG_KEY`), the
  Analytics rows above do not apply to that build.
- The encryption export-compliance answer is "No" via
  `ios.infoPlist.ITSAppUsesNonExemptEncryption = false` in `app.config.ts`.
