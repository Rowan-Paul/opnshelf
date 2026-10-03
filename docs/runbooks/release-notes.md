# Publishing Release Notes

Release Notes live in `apps/web/content/release-notes/*.md`. Both clients use
`/whats-new` and `/whats-new/<slug>`. The public JSON feed is served by Web at
`/api/release-notes`; Mobile reads it from its existing `EXPO_PUBLIC_SITE_URL`.
Markdown bodies support headings, lists, links, and HTTPS screenshot URLs.
Use absolute HTTPS links and image URLs so they work on both clients.

## Prepare a release

1. Copy `whats-new.md` as a template. Keep `status: "draft"` until the operator
   approves the text and at least one client is ready to receive the feature.
2. Set a unique lowercase hyphenated `slug`, title, short summary, and unique
   `publishedAt` UTC timestamp in ISO form, including milliseconds and `Z`.
   Use the actual publication time, not the date development began. New accounts
   start caught up through their creation time, so backdating hides the dot from
   accounts created after that timestamp.
3. Set Web, iOS, and Android availability to `available`, `coming-soon`, or
   `update-required`. A platform may include `minimumVersion` (e.g. `1.7.0`)
   and a short `note`. State per-feature differences in the Markdown body.
   OTA availability needs explicit wording; a native version alone cannot prove
   an OTA has been installed. Do not announce a store feature as available while
   it is still awaiting review.
4. Preview locally and run `pnpm --filter web run test`. The content tests validate
   drafts too. Temporarily change status locally to preview a draft, then restore
   it. Never commit a premature publication status to obtain a preview.
5. With operator publication approval, set `status: "published"` and the actual
   publication timestamp, and deploy through the normal production release flow.
   The Web build must use `VITE_SITE_URL=https://opnshelf.xyz`. Other deployed
   origins fail closed with an empty feed; local development can preview entries.
   Future-dated notes stay hidden until their timestamp. No deployment is
   authorized merely by editing a note.
6. Verify the production page and feed before manually posting the shorter
   Bluesky announcement with its full Web URL.

Keep slug and publication timestamp unchanged after publication. Correct copy
and update availability in place through another approved Web deployment; those
edits do not create unread state. A new announcement needs a new slug/timestamp.
Do not backfill past releases or publish internal-only deployment changes.

## Deployment dependencies

Deploy the additive `releaseNotesReadAt` database migration and Backend endpoints
before clients use read state. This is private account state, never a PDS record.
A missing read-state endpoint leaves public notes readable without an unread dot.
Apply migrations only with operator approval on shared databases.

The Mobile change is JavaScript-only and leaves `app.config.ts` version unchanged:
it can ship by OTA to a compatible runtime, with operator approval. Installations
without the Release Notes UI need that first update; thereafter notes themselves
arrive from Web without another Mobile update. An older app's availability text
is informational, not feature gating.

## Link behavior and environment previews

Bluesky HTTPS links open the public Web App. The matching Mobile routes support
in-app navigation, but this OTA does not add Android App Links or iOS Universal
Links for Release Notes. Add both platforms together in a future store release
(ADR 0022), with operator approval for the native release switch.

Staging intentionally serves an empty feed, including to Staging Mobile. It must
not publish announcements from an unreleased branch. To inspect populated Mobile
screens, run local Web and set `EXPO_PUBLIC_SITE_URL` to that local server before
starting Metro (Android emulators use `http://10.0.2.2:<port>`; iOS simulators can
use `http://127.0.0.1:<port>`). Without this override, local Mobile uses the existing
production site default. Use temporary local content and restore draft status
before committing.

The availability statuses are a compatibility contract for installed Mobile
clients: do not add or rename a status in the existing feed. Express additional
detail through the optional `note` or Markdown body. A new status requires a
versioned feed and a client migration that preserves the old feed.

The first announcement stays draft until its copy and publication are approved.
An empty initial history is intentional; merging this feature does not authorize
announcing it.
