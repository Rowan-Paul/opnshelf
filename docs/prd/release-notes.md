# Release Notes

Issue: [#321](https://github.com/Rowan-Paul/opnshelf/issues/321)

Status: Design confirmed by the operator on 2026-10-03. Implemented and visually
verified on Web and Android (Pixel 10, Android 17): Profile unread dot, Settings
row, history, detail, and clearing the dot after reading. Verification used local
fixture data. iOS remains visually unverified; its simulator was in use by another
session. Not deployed.

## Agreed direction

- Help existing Users discover useful product changes inside Opnshelf.
- Provide Release Notes in both the Web App and Mobile App.
- Reuse the operator's existing habit of writing a Bluesky announcement for
  each release.
- Continue publishing to both destinations: Release Notes are the complete
  version, with a shorter Bluesky announcement linking to them.
- Defer the public blog/Leaflet publishing idea from this issue's initial scope.

## Discovery and access

- Both clients expose a **What's new** link with an unread indicator, opening
  a browsable history. New notes do not automatically interrupt Users with a popup.
- Full notes are publicly readable without signing in on the Web App, with
  matching Mobile App routes for in-app navigation. Bluesky HTTPS links open
  the Web App. Native capture of these links on both platforms is deferred to
  a future store build; this release retains the OTA rollout.
- Put **What's new** in the Web account menu and Mobile Settings, with an
  unread indicator also on the control leading to that destination. Include
  a public Web footer link for signed-out visitors.

## Read state and entries

- Read state is account-wide: opening the history clears unread state through
  the newest entry actually loaded and successfully displayed, across Web and
  Mobile. A failed load does not advance read state. Opening a direct link to
  one entry does not clear unread state for the whole history.
- Signed-out visitors can browse without an unread indicator. New accounts
  start caught up with the existing history.
- Corrections and availability updates edit the existing entry without making
  it unread again. Only a newly published announcement creates unread state.
- Entries are curated for meaningful user-facing changes; deployments with
  only internal maintenance do not need one.
- Each entry has a title, date, stable link, and platform availability. Entry
  identity is independent of mobile version numbers.

## Authoring and availability

- Author notes as Markdown in the repository. Drafts can be prepared from
  changes and refined with the operator before release; no administrative
  editor is needed initially.
- Publish notes when the first client receives the change, explicitly describing
  availability on Web, iOS, and Android. Update availability as the other
  clients receive it instead of waiting for every client before publishing.
- Approved Markdown becomes public with the production Web deployment, once
  the described change is available on at least one client. Drafts and Staging
  notes stay out of the public feed.
- Bluesky posting remains manual initially.

## Delivery and content boundaries

- Both clients read the same published feed. Older Mobile App installations
  that support Release Notes fetch new entries without needing an app update
  just to receive the notes.
- Notes distinguish **available**, **coming soon**, and **update required**,
  including minimum app versions where applicable. Entries that bundle changes
  with different availability explain it per feature. Mobile OTA availability
  cannot be inferred from the native app version alone.
- Begin with the next release; do not backfill historical Bluesky announcements.
- Entries may explain how to use the announced features and include screenshots.
  Standalone feature tutorials are outside the initial scope.

## Verified constraints

The release workflow creates GitHub release bodies from commit subjects.
It publishes the GitHub release before store build dispatch or OTA completion;
that event does not establish availability across clients. Store builds and
OTA updates also do not share one versioning scheme with GitHub release tags.
See `.github/workflows/release.yml`.

Existing Leaflet integration mirrors Users' Reviews to their Publications
(ADR 0013); it is not an official Opnshelf announcement channel.

## Completion and implementation boundaries

No product decisions remain open from the interview. The operator confirmed
the complete shared understanding and authorized implementation in the design
conversation for #321 (2026-10-03). The repeated approvals covered account-wide
unread state, platform availability, production-only publication, and starting
with the next release rather than backfilling. These are conversation decisions,
not claims that the original issue body specified them. During PR #439 review,
the operator explicitly retained OTA and deferred native link capture.

Feed transport, Markdown schema and rendering, storage of account-wide read
state, and the shared route shape are implementation choices subject to this
contract and the accepted ADRs. Follow ADR 0023 for matching Web and Mobile URLs.
The public feed must not expose unpublished content, and a successful history
view must not mark concurrently published, unseen entries as read.

This brief does not authorize deployment or publication of notes or Bluesky
posts.

Architecture and trade-offs: [ADR 0043](../adr/0043-release-notes-use-web-content-and-private-read-state.md).
