# Bingers Sync

Design brief and compatibility assessment for
[issue #529](https://github.com/Rowan-Paul/opnshelf/issues/529).
Assessed on 2026-11-06. Status: limited inbound integration implemented; live
Bingers authorization remains unverified. The operator chose the limited inbound
version on 2026-11-06. The representability restrictions below follow
[ADR 0049](../adr/0049-trakt-sync-links-records-alongside-one-time-import.md).

## API compatibility

The first-party [developer page](https://bingers.app/developers) confirms that
the public API is beta and requires a Legend or Icon subscription. The
[developer guide](https://bingers.app/llms-full.txt) documents browser OAuth with
PKCE, refresh tokens, and a hosted HTTPS client metadata document instead of
manual client registration. Use `openid`, `library:read`, `offline_access` and `profile`
for the inbound integration. Do not request write access until an
outbound scope is supported. Pass the API resource audience during authorization.
The live [OAuth discovery document](https://api.bingers.app/.well-known/oauth-authorization-server)
advertises authorization, token, revocation and userinfo endpoints and S256.

The [OpenAPI contract](https://api.bingers.app/v1/openapi.json) defines one
`EntryRow` per episode or movie: `watched`, `plays`, first/last Watch timestamps,
Rating, update time and tombstone. It does not expose individual viewing IDs or
all viewing timestamps. Episode entries identify an episode UUID and parent
title UUID, without season/episode numbers. The episode lookup and `/me` success
responses have no response schema in that contract. Typed payloads for those
responses must be verified before relying on them.

The guide documents cursor-based change feeds, per-user limits of 60 requests
per minute and 1,000 per hour, and `Retry-After` on throttling. A cursor-less
history read is budgeted separately. It also documents a 12-hour duplicate
window on Watch writes. Consequently, a generic replay of Opnshelf Watches is
not a faithful export.

## Agreed scope

Opnshelf stores individual Watches and preserves their identity, timestamps and
rewatches. The shared core must not manufacture missing viewings or collapse
local history to match a provider (ADRs 0049 and 0051).

The operator chose a limited inbound integration now, with unrepresentable
Watch aggregates in Needs attention. Full two-way Watch synchronization is not
claimed. No dates are invented from play counts, and an aggregate's last Watch
never replaces an earlier imported individual Watch. Outbound configuration and
explicit outbound resolutions are rejected on the server.

## First version

Reuse the [shared integration core](../adr/0051-integrations-share-one-sync-core.md).
No separate import job or provider-specific conflict engine.

| Data | Support | Boundary |
| --- | --- | --- |
| Movie Watches | Bingers → Opnshelf | One play with equal, known first/last timestamps is representable. All other Watch aggregates need attention. |
| Movie Ratings | Bingers → Opnshelf | Multiply Bingers' 1–5 half-star scale by two. A null Rating is absence, not zero. |
| Episode Watches and Ratings | Held in Needs attention | The feed provides UUIDs without coordinates; no episode lookup response schema has been verified. |
| Show and season Ratings | Unsupported | Do not translate them into episode Ratings. |
| Watchlist, Favorites and custom Lists | Deferred | They need their own membership, ordering, visibility and deletion contract verification. |
| Library Items, Notes and Reviews | Unsupported in this version | Bingers library membership is not Opnshelf ownership. Feelings are not Reviews. |

Expose the inbound direction and supported types only. Reject unsupported
settings on the server as well as hiding them in clients. Even an explicit
Needs attention resolution must not bypass the adapter's outbound restriction.
Any later outbound scope needs verified readback, deletion and retry semantics.

### Initial and ongoing reads

Read all history pages once, then persist the change-feed cursor with the
materialized remote state. Subsequent runs apply deltas, including tombstones,
to that state before presenting a complete snapshot to the core. A delta page
is never itself a snapshot: absent records on it are not deletions.

Commit cursor advancement and its corresponding materialized state together,
under the existing connection lease. A failed or malformed page preserves the
last complete state and cursor. A process restart must not force a full history
read. Connection identity and feed state are scoped to the Bingers account;
switching accounts must not reuse another account's cursor or record links.

Resolve title identity using TMDB plus the movie/show kind. Episode records are
held with an explicit unknown-coordinates marker, so their
Needs attention titles never display invented season/episode numbers. A later
episode lookup needs verified payloads and a completeness check for large shows.
Missing mappings and unsupported aggregates remain visible in
Needs attention. Never substitute episode zero or an invented title match.

Fixtures cover null dates, mismatched first/last dates, zero or multiple plays, tombstones and inconsistent rows.
After a single viewing becomes an aggregate, the existing link is held for attention;
the earlier imported Watch is not replaced with the aggregate's last timestamp.

### Conflicts and duplicates

Keep the core's account-scoped links, saved baselines, unambiguous initial
matching, echo suppression, history scope, Ignore and undo. Preserve unrelated
destination Watches. Propagate a deletion only from an authoritative tombstone
or complete state for a previously linked, representable record. An unsupported
or unreadable record must remain present with a problem, never appear deleted.

### Privacy and connection lifecycle

Connecting must not transfer data until the User chooses types/history scope
and acknowledges publication. Follow the existing public-Watch sync restriction:
hold Watch transfers while Shelf privacy is Private or moving. Ratings may
continue independently. Do not change privacy settings to make sync possible.

Keep OAuth state single-use and expiring, encrypt credentials at rest, refresh
under the connection lease, and never log credentials or authorization payloads.
Verify stable account identity and granted scopes before saving a connection.
Subscription rejection must explain the Legend/Icon requirement; expired or
revoked access must offer reconnection. Honor throttling without discarding work.

Pause stops transfers. Disconnect stops sync and revokes access without deleting
transferred records. Retain account-scoped links for reconnection. Clear the cached feed, cursor and
remote snapshot on disconnect; reconnection obtains a fresh complete read. Account deletion must invoke provider
disconnect before deleting local sync state. Whether a Bingers refresh-token
revocation invalidates the whole grant needs a controlled verification.

### Web and Mobile parity

Register Bingers once in `packages/api/src/integrations.ts` so both clients use
the existing Integrations list, setup, management and Needs attention surfaces.
Use `/integrations/bingers` on both clients and support the onboarding return
path. Show the beta/subscription requirement and limited Watch support before
connection. A neutral B initial distinguishes Bingers without borrowing another provider's logo.

## Implementation and verification

The adapter uses the shared core for reconciliation, privacy holds and account
locks. OAuth credentials and expiring single-use state use provider-specific
AES-GCM encryption. The publicly served metadata document is the client ID;
there is no extra Bingers API key to configure. Existing `BACKEND_PUBLIC_URL`
(HTTPS), `FRONTEND_URL` and `PROVIDER_STATE_SECRET` enable the integration.

The Bingers Integration service owns the `remoteFeed` connection column, saving
a cursor and materialized normalized records together. The HTTP client returns
read results without writing to the database or advancing durable state. It excludes tokens and unrelated Bingers feelings/profile
fields. Status polling omits both large feed state and the core's snapshot.
The owning Prisma and OpenAPI commands regenerated their output.

Tests cover exact/aggregate mapping, null/inconsistent history, episode holds,
pagination failure, cursor replay across restarts, tombstones, scope denial,
refresh response omissions, safe error reporting, single-use OAuth state,
outbound rejection and preservation of a linked Watch after an aggregate update.
Client fixtures exercise subscription copy, inbound setup, publication consent
and Needs attention without real API/PDS writes.

The migration adds `IntegrationConnection.remoteFeed`. It has not been applied
to a hosted database. Apply it through the normal approved deployment process
before starting the new backend. The Mobile App version is unchanged: this needs
an OTA update after the backend is ready, not a store build for a new native API.
No deployment or update is authorized by this implementation.

Remaining external verification: use an authorized Legend/Icon test account to
check Bingers consent, OpenID identity issuance, token rotation/revocation, actual feed
payloads and subscription errors. No authenticated Bingers calls or account
writes were made. Episodes remain unsupported until their mapping contract is
verified; full rewatch import requires individual viewing history.


### Local verification on 2026-11-06

- `pnpm prisma:generate`, `pnpm generate:api`, and
  `pnpm --filter @opnshelf/api exec tsc --noEmit` completed.
- Root `pnpm typecheck` and `pnpm check` passed. Existing lint warnings remain.
- Backend tests/build, Web tests, Mobile tests and `pnpm test:scripts` were run.
  Database-dependent Backend suites were skipped without a local test database.
- Web: `/integrations/bingers` and `/integrations/bingers/attention`, on the
  local fixture at port 3395. Verified connection return, the sole inbound
  direction, publication consent, aggregate Needs attention and a 390px layout
  without horizontal overflow. The fixture makes no Bingers or PDS calls.
- iOS: a fresh iPhone 18 Pro simulator build succeeded, was installed and opened.
  Visual route verification stopped after the device command repeatedly returned
  `Error (COMMAND_FAILED): alert not found`, including its suggested diagnostic
  retry. No Mobile visual success is claimed. Android visual verification was
  not performed.


### Opus review fixes (2026-11-09)

- Consolidated Trakt and Bingers encrypted OAuth state, account binding, callbacks
  and credential refresh in `OAuthIntegrationSyncService`. Existing Trakt
  ciphertexts, expiry semantics and legacy callback URLs have compatibility tests.
- A rejected cursor triggers one complete reread. Only a complete replacement
  advances saved state; failure keeps the previous state and never applies an
  empty or partial snapshot. Empty delta pages may omit `titles`; live rows must
  still have matching title details.
- Subscription/scope 403 errors ask for reconnection rather than retrying every
  minute. Rate-limit retries continue to honor `Retry-After`.
- Account identity comes from the signed OpenID ID token with JWKS signature,
  issuer, client audience, expiry, authorized-party and nonce checks. The
  API-audience bearer token is never sent to the userinfo endpoint. Live token
  issuance still needs an authorized account check.
- Disconnect clears both cached remote snapshots even when remote revocation
  fails, retaining only the account-scoped links and their baselines as required
  by ADR 0049. Scoped confirmation reads do not persist a cursor.
- Added Trakt/Popfeed tests proving unsupported records stay unpaired and
  retry-only. This shared representability safeguard is intentional; it prevents
  an unsupported record from acquiring a link that could later propagate data
  loss. Lists already prohibit manual link resolution.
- Replaced retired Import/Connection copy, removed the redundant notice field,
  aligned client error states, moved Bingers next to the other Integration terms,
  removed the `issues` forwarding method, and made OAuth return URLs a server
  response used by Mobile management and onboarding.


### Review-fix verification on 2026-11-09

All Opus findings were addressed. Root typecheck and check, Backend build,
API generation/typechecking and 36 script tests passed. Full suites passed:
Backend 1,480 tests, Web 656 tests and Mobile 652 tests. Backend and Web used
`--maxWorkers=2` after concurrent native compilation caused isolated five-second
test timeouts. The 132 database-dependent Backend tests remain skipped because
the local Docker daemon is unavailable.

Web `/integrations/bingers` was checked at the local port-3395 fixture at 390px:
subscription copy appears once, uses the glossary terms and does not overflow.
Live Bingers consent and token issuance remain unverified; no authenticated
Bingers requests, hosted migrations or deployments were performed.


The iOS verification retry on 2026-11-09 built and installed a fresh iPhone 18 Pro
simulator artifact. The unsigned artifact could launch but could not use
SecureStore because it lacked the Keychain entitlement. A locally signed test
artifact then failed to remain running; the device tool returned
`app 'com.rowanpaul.opnshelf' is not running` after both launch and the prescribed
relaunch. Simulator automation was stopped. This does not establish a successful
check of `/integrations/bingers`; authenticated Mobile visual verification
remains incomplete. No tracked signing configuration was changed.

### Pre-publication review follow-ups

Opus reviewed commit `299cbff4438483eafd5745f89d3a57a508b281bc` and reported no
publication blockers. The shared problem-record safeguards intentionally apply to
Trakt and Popfeed too: this is the common core's representability policy, with
provider regression tests. Nonblocking helper/DTO naming cleanup is deferred to
avoid unnecessary API-schema churn.

Follow-up fixes guard feed persistence with an atomic comparison of the captured
lease ID and its live expiry, revoke both OAuth tokens if an authorization cannot
be saved, and prevent scoped confirmation reads from starting or recovering via a
cursor-less complete read. Focused tests cover these cases. These small changes
were verified locally rather than sent for another delegated review.
