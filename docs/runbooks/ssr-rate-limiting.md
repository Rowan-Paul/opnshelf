# SSR visitor rate limiting

Implements [ADR 0025's SSR identity amendment](../adr/0025-in-memory-rate-limiting-assumes-one-backend-replica.md).

## Required trusted-edge verification

**Not yet verified:** Railway documents supplying `X-Real-IP`, but does not
promise in the linked specification that client-supplied values are replaced.
Leave `SSR_RATE_LIMIT_SECRET` unset until the following test passes in the
actual target environment. The signing code alone cannot establish this trust.

1. With forwarding disabled, use an operator-approved temporary server-side
   probe behind the same Railway edge and routing as Web. Record only the
   received `X-Real-IP`, never cookies, authorization, or signing headers.
2. From one known client, make a baseline request, then requests carrying
   `X-Real-IP: 198.51.100.123` and `X-Real-IP: 203.0.113.123`, including a
   duplicate-header request. Check what Web receives, not the edge's `srcIp`
   log field: that field alone cannot establish header replacement.
3. Pass only if all requests arrive with the actual client address, independent
   of the supplied header. Record the date, environment, and result in the
   rollout PR, then remove the probe. Repeat if the ingress/proxy chain changes.
4. If any supplied address survives, do not activate forwarding. Establish an
   ingress that overwrites this header and prevents bypass, then repeat.

## Activation with the next authorized deployment

- Set `SSR_RATE_LIMIT_SECRET` to the same cryptographically random secret
  (at least 32 characters; prefer 32 random bytes encoded as hex) on **Web**
  and **Server** in the same Railway environment. Use separate secrets for
  Staging and production. Never commit or print the value.
- This is a runtime server variable. Do not prefix it with `VITE_`, pass it as
  a Docker build argument, or expose it to the browser.
- Deploying Server before Web is recommended, not required. Until both have the same key and updated code,
  requests keep the existing peer-IP behavior. A missing key disables forwarding; it does not disable rate limiting.
  Web rejects a configured key shorter than 32 characters; the API ignores it.
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
