# Turnstile-Protected Railway PDS

This repo now includes two deployment helpers for running a Bluesky PDS behind a Turnstile-backed signup gate while keeping Railway as the host:

- `apps/pds-gatekeeper`: a small ATProto-compatible signup gatekeeper
- `apps/pds-edge-proxy`: a Caddy reverse proxy that exposes the PDS publicly and routes protected signup paths to the gatekeeper

## Service layout

Create three Railway services from this repo or from your existing PDS repo setup:

1. `pds-origin`
   - Your existing Bluesky PDS template service
   - Internal only after rollout
   - Private network target: `http://pds-origin.railway.internal:3000`
2. `pds-gatekeeper`
   - Dockerfile path: `apps/pds-gatekeeper/Dockerfile`
   - Public networking disabled
   - Attach a Railway volume mounted at `/data`
3. `pds-edge-proxy`
   - Dockerfile path: `apps/pds-edge-proxy/Dockerfile`
   - Public networking enabled
   - Attach both your apex domain and wildcard domain

## Gatekeeper environment

Set these on `pds-gatekeeper`:

```env
HOST=0.0.0.0
PORT=8080
PDS_BASE_URL=http://pds-origin.railway.internal:3000
PDS_HOSTNAME=example.com
TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret-key
TURNSTILE_EXPECTED_HOSTNAME=example.com
TURNSTILE_EXPECTED_ACTION=signup
GATEKEEPER_DB_PATH=/data/gatekeeper.sqlite
GATEKEEPER_SIGNUP_CODE_TTL_SECONDS=300
GATEKEEPER_ENABLE_SIGNUP_PROTECTION=true
GATEKEEPER_DEFAULT_CAPTCHA_REDIRECT=https://bsky.app
GATEKEEPER_CAPTCHA_SUCCESS_REDIRECTS=https://bsky.app,https://your-app.example.com
```

## Edge proxy environment

Set these on `pds-edge-proxy`:

```env
PORT=8080
PDS_BASE_URL=http://pds-origin.railway.internal:3000
GATEKEEPER_BASE_URL=http://pds-gatekeeper.railway.internal:8080
```

## Public routing behavior

The proxy routes these paths to the gatekeeper:

- `/xrpc/com.atproto.server.describeServer`
- `/xrpc/com.atproto.server.createAccount`
- `/gate/*`

Everything else is forwarded directly to the origin PDS, including normal XRPC traffic and websocket federation.

## Cloudflare and Railway DNS

Use your apex domain for the PDS host when possible, for example:

- PDS hostname: `example.com`
- User handles: `alice.example.com`

On Railway:

1. Attach `example.com` to `pds-edge-proxy`
2. Attach `*.example.com` to `pds-edge-proxy`
3. Keep `_acme-challenge` verification records DNS-only

On Cloudflare:

1. Proxy the apex and wildcard CNAMEs through the orange cloud
2. Enable Universal SSL
3. Set SSL/TLS mode to `Full`

## Suggested Cloudflare rate limits

Use rate limiting rules as defense in depth, not as the primary signup gate.

Recommended starting points:

- `/gate/*`
  - Count by IP
  - 10 requests per minute
  - Action: Managed Challenge or block after repeated abuse
- `/xrpc/com.atproto.server.createAccount`
  - Count by IP
  - 5 requests per 10 minutes
  - Action: block

Do not put a Cloudflare challenge directly in front of the XRPC signup endpoint as the main control. The client needs the ATProto-compatible `verificationCode` flow.

## Rollout checklist

1. Deploy `pds-gatekeeper`
2. Deploy `pds-edge-proxy`
3. Move the public custom domains from `pds-origin` to `pds-edge-proxy`
4. Confirm `https://example.com/xrpc/_health` still works
5. Confirm `GET /xrpc/com.atproto.server.describeServer` returns `phoneVerificationRequired: true`
6. Confirm direct `createAccount` calls without `verificationCode` fail
7. Confirm `/gate/signup` returns a code and a fresh signup succeeds
8. Confirm reusing the same code fails
9. Confirm websocket federation still works through the proxy

## Notes

- This phase intentionally protects signup only.
- Login and 2FA overrides are out of scope here.
- The gatekeeper stores one-time signup codes in SQLite on the attached Railway volume.
