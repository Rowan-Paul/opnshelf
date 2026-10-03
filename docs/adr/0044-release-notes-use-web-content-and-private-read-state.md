# ADR 0044: Release Notes use Web content and private account read state

Status: Accepted; implemented in PR #439.

Release announcements previously lived in manual Bluesky posts. In the design
conversation for issue #321, the operator agreed to in-app Release Notes, one
history across clients, account-wide unread state, explicit platform availability,
and publication beginning with the next release. Leaflet publishing was deferred.
The [product brief](../prd/release-notes.md) records that agreement; the original
issue body alone is not the full specification.

## Decision

Curated Markdown lives in `apps/web/content/release-notes/`. Web owns rendering
and serves a public `/api/release-notes` feed; Mobile reads that feed from its
configured Web origin. This keeps approval, content, and public links in one
deployment and lets installed Mobile clients receive new notes without an update.
A Backend content store or CMS would add authoring infrastructure for a single
operator; a Leaflet mirror would introduce another publishing dependency.

Only explicitly published, non-future entries reach the feed. Deployed Web must
have `VITE_SITE_URL=https://opnshelf.xyz`; Staging and unknown origins return an
empty feed, while local development can preview entries. The gate uses deployment
configuration, never a request Host header. This deliberately prevents a Staging
deployment from publishing branch announcements. Staging Mobile therefore has an
empty history; populated verification uses a local Web preview.

Read state is a private timestamp on the Backend User, not a public PDS record.
It is app bookkeeping with no federation value. A single atomic monotonic update
makes acknowledgements safe across devices. New accounts start caught up;
successfully displaying history acknowledges only its newest loaded timestamp.
Opening a detail URL or editing existing copy does not acknowledge the history.

## Consequences

- Both clients use `/whats-new` and `/whats-new/<slug>` (ADR 0023). For this OTA,
  Bluesky HTTPS links remain in Web. Native capture is deferred on both platforms
  together (ADR 0022), as the operator confirmed during PR review. Signed-out
  discovery is the public Web footer; Mobile discovery is Settings.
- Publishing or correcting notes requires a production Web deployment. A Web
  outage also affects Mobile notes; cached content remains visible on refetch
  failure. Read-state failure does not prevent public reading.
- The feed's availability vocabulary is stable for older installed clients.
  Extend explanatory text freely; new status values require a versioned feed.
  Entries use canonical UTC ISO timestamps so lexical ordering is chronological.
- The first announcement remains a draft pending separate publication approval.
  There is no historical backfill and no automatic Bluesky posting.
- Apply the Backend migration before clients. This feature leaves the Mobile
  native version unchanged; deployments and OTA publication need operator approval.

See the [authoring runbook](../runbooks/release-notes.md) for local preview and
publication procedures.
