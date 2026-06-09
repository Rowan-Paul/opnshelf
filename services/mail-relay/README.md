# opnshelf mail-relay

A tiny SMTP→HTTPS bridge. The Tranquil PDS sends account email (verification,
password reset) via an **SMTP smarthost**, but Railway blocks outbound SMTP
(ports 25/465/587/2525) on Hobby plans — so the PDS can't reach Cloudflare's
SMTP endpoint directly.

This service accepts SMTP on Railway's **private network** (internal traffic
isn't subject to the public-egress SMTP block) and forwards each message to
**Cloudflare Email Sending's REST API over HTTPS** (port 443, which Railway
allows).

```
Tranquil PDS ──SMTP :2500 (railway.internal)──▶ mail-relay ──HTTPS 443──▶ Cloudflare
```

See ADR `docs/adr/0007-cloudflare-email-sending.md` for the why.

## How it works

`smtp-server` listens (plaintext, no auth — it's an internal-only listener),
`mailparser` parses the RFC822 message, and the From/To/Subject/text/html are
mapped onto Cloudflare's `POST /accounts/{id}/email/sending/send` body. Upstream
failures return a 451 so the PDS re-queues and retries.

## Environment

| var | required | notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | yes | User-owned token, scope *Email Sending: Edit* (the `opnshelf.social` one). **Not** an account-owned `cfat_` token — Email Sending rejects those. |
| `CLOUDFLARE_ACCOUNT_ID` | yes | |
| `SMTP_PORT` | no | Defaults to `2500`. Avoid 25/465/587/2525 (Railway-blocked). |

## Deploy on Railway

1. New service in the **same project** as `tranquil-pds` (so the private network is shared).
2. Point it at this repo, set **Root Directory = `services/mail-relay`** (the Dockerfile is auto-detected; build context is this dir only — no monorepo install).
3. Set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
4. No public domain needed — it's reached internally at `<service-name>.railway.internal`.

## Point Tranquil at it

On the **tranquil-pds** service, replace the Cloudflare-SMTP vars with:

| var | value |
|---|---|
| `MAIL_SMARTHOST_HOST` | `<relay-service-name>.railway.internal` |
| `MAIL_SMARTHOST_PORT` | `2500` |
| `MAIL_SMARTHOST_TLS` | `none` |
| `MAIL_FROM_ADDRESS` | `noreply@opnshelf.social` |
| `MAIL_SMARTHOST_USERNAME` | *(remove)* |
| `MAIL_SMARTHOST_PASSWORD` | *(remove)* |

`MAIL_SMARTHOST_TLS=none` requires **no password** — Tranquil refuses to boot
with `tls=none` while a password is set. If Tranquil insists on auth and won't
boot, the fallback is to give this relay a TLS cert and switch the mode back;
open an issue before going down that path.

Redeploy, trigger a signup, confirm the code email arrives, and check the PDS
log for `relayed: from=noreply@opnshelf.social …` on this service.

## Local test

```bash
CLOUDFLARE_API_TOKEN=dummy CLOUDFLARE_ACCOUNT_ID=dummy node index.js
# then send a test message to localhost:2500 over plain SMTP
```
