# SSR visitor rate limiting

Issue #314 was observed after #296 shipped: public show and episode loaders
still called the API from the Web container without a session. At
2026-09-12 19:04:16 UTC, Railway recorded `node` requests for
`/shows/tmdb/615` and `/shows/tmdb/615/season/9/episode/3` returning 429
from the same source IP as unrelated SSR requests. The browser's `/auth/me`
call succeeded. PostHog recorded the episode route error immediately afterward.

Web's shared API request interceptor now signs Railway's `X-Real-IP` with
HMAC-SHA256. The API accepts a valid signature for 60 seconds and uses that
visitor's ordinary IP bucket. Known sessions retain priority. Missing,
malformed, expired, or forged signatures retain the peer-IP limit. The
signature does not authenticate a user or bypass any limiter. Counters remain
in memory on one backend replica, as specified by ADR 0025.

## Activation with the next authorized deployment

- Set `SSR_RATE_LIMIT_SECRET` to the same cryptographically random secret
  (at least 32 characters; prefer 32 random bytes encoded as hex) on **Web**
  and **Server** in the same Railway environment. Use separate secrets for
  Staging and production. Never commit or print the value.
- This is a runtime server variable. Do not prefix it with `VITE_`, pass it as
  a Docker build argument, or expose it to the browser.
- Deploy Server before Web. Until both have the same key and updated code,
  requests keep the existing peer-IP behavior. A missing or short key disables
  forwarding; it does not disable rate limiting.
- Web must be reached through Railway's edge, which supplies `X-Real-IP`.
  Do not expose the Web listening port directly to untrusted callers when
  forwarding is enabled. Local development should leave the key unset unless
  exercising the trusted-proxy setup explicitly. This is based on
  [Railway's request header contract](https://docs.railway.com/networking/public-networking/specs-and-limits#technical-specifications).
- Verify a public episode route loads during traffic from another visitor,
  while a single visitor exceeding 100 requests per endpoint per minute still
  receives 429. Never log the forwarding signature or the secret.

This needs a Web/API deployment and runtime configuration. Mobile uses direct
API requests and needs no code change, store build, or OTA update.
