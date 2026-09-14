# ADR 0025: In-memory rate limiting assumes one backend replica

Status: accepted.

The backend rate-limits in process memory in three places.
`ThrottlerModule.forRoot` in `backend/src/app.module.ts` sets a global limit of
100 requests per 60 seconds and passes no `storage` option, so
`@nestjs/throttler` keeps its counters in its default in-memory store.
`SessionThrottlerGuard` (`backend/src/common/session-throttler.guard.ts`) only
changes the bucket key — a known session id, otherwise a verified SSR visitor IP or the peer IP — not where
the counts live. `SignupRateLimiter` (`backend/src/auth/signup-rate-limiter.ts`),
shared by the signup controllers, then adds two hand-rolled limiters as private
`Map`s on that singleton:
`registerAttempts`, five signups per IP per hour, and `resendAttempts`, five
verification-email resends per DID per hour.

All three share the same properties. State lives in one Node process. It is
gone on every deploy, restart or crash, and on Staging on every sleep and wake,
because that service has `sleepApplication` on. Two replicas would each hold
their own counters and never see each other's.

## Decision

Accept this for the current deployment. The `Server` service in the `opnshelf`
Railway project runs a single replica (`numReplicas: 1`, one region) in both
production and Staging. With one process the counters are exact between
restarts, and a reset on deploy costs nothing beyond handing a full quota to
whoever was mid-window. A Redis service or a counters table would add
infrastructure to protect against a scaling step nobody has taken, so we do
not add it now.

## Trigger to revisit

Raising the backend replica count above one, or adding a second region,
invalidates this decision. With N replicas every limit is effectively N times
higher, and Railway's load balancing decides per request which replica — and
so which counter — a client lands on, so the limit becomes both looser and
nondeterministic. The signup limiter is the one that matters: it fronts
invite-code minting on the PDS (`CaptchaService` and `TranquilAdminService` in
`backend/src/pds/`), so a loosened limit means more bot accounts on the
Opnshelf-hosted handle domain.

Before scaling, do the following in the same change:

- Give `ThrottlerModule` a shared store: a Redis-backed `ThrottlerStorage`
  implementation on a Railway Redis service, or a small Postgres-backed one on
  the existing database if a second datastore is not wanted.
- Move the register and resend limiters onto that same store, or express them
  as per-route `@Throttle` overrides with custom trackers so there is one
  mechanism instead of three.
- Keep `SessionThrottlerGuard.getTracker` as the key function. Only the store
  changes.

## Consequences

- A deploy resets every bucket. A bursty client gets a fresh 100 requests right
  after a release, and an address blocked on signup gets five more tries. Both
  are accepted.
- Staging's sleep resets the counters too, so rate-limit durability cannot be
  observed on Staging; only the per-request behaviour can.
- Adding replicas without reading this ADR silently weakens signup protection.
  `plans/README.md` already lists "multi-replica background-job claiming" as a
  scaling investigation with the same trigger; treat the two together when the
  time comes.
- The storage decision adds no dependency. The SSR identity amendment below
  changes bucket selection without changing storage.

## Amendment: preserve visitor identity through SSR (PR #318)

The #296 fix removed anonymous SSR session checks but left public loaders
sharing the Web container's IP. On September 12, 2026, the show and episode
requests for Futurama S9E3 returned 429 while unrelated renders used the same
source IP. The browser's own session check succeeded. Bucket isolation, not a
higher quota or a different store, addresses that failure.

Web signs the edge-provided visitor IP and timestamp with HMAC-SHA256 using a
server-only secret shared with the API. The API accepts signatures within 60
seconds of its clock, allowing clock skew in either direction. Known sessions
retain priority; invalid or absent signatures fall back to the peer IP. This
proof selects a bucket only and never grants authentication or authorization.
It can be replayed within that window against the same bucket, not used to
mint arbitrary buckets. The separate signup limiter still uses its existing IP
policy. We do not introduce a general signed-token abstraction: provider CSRF
state and this transport proof have different payload and validity rules.

This adds a trust boundary: Web may assert a visitor IP only if the edge
replaces client-supplied `X-Real-IP`. Railway documents supplying that header,
but its overwrite behavior has **not been verified** for this deployment.
Activation is conditional on the spoof test in the [runbook](../runbooks/ssr-rate-limiting.md).
Until it passes, leave `SSR_RATE_LIMIT_SECRET` unset. If it fails, do not enable
forwarding: establish a proxy boundary that overwrites the header first.
Direct public access to the Web listening port would invalidate this trust.

We reject trusting unsigned visitor headers on the public API: that would let
callers choose unlimited buckets. Increasing the shared quota would only move
the failure threshold. The cost of authenticated forwarding is one runtime
secret per environment, shared between two services. Either deployment order
is compatible; forwarding activates only when both services support it and
have matching keys. Mobile continues to call the API directly.
