# ADR 0025: In-memory rate limiting assumes one backend replica

Status: accepted.

The backend rate-limits in process memory in three places.
`ThrottlerModule.forRoot` in `backend/src/app.module.ts` sets a global limit of
100 requests per 60 seconds and passes no `storage` option, so
`@nestjs/throttler` keeps its counters in its default in-memory store.
`SessionThrottlerGuard` (`backend/src/common/session-throttler.guard.ts`) only
changes the bucket key — a known session id, otherwise the peer IP — not where
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
- No new dependency and no code change today. This record exists so the
  assumption is written down where the scaling decision will find it.
