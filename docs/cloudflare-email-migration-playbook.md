# Playbook: migrating a project's email to Cloudflare Email Sending

A reusable runbook for moving a project off a transactional email provider (Resend,
SendGrid, etc.) onto **Cloudflare Email Sending**. Written from the opnshelf
migration — see ADR `docs/adr/0007-cloudflare-email-sending.md` and the worked
implementations in `backend/src/email/` and `services/mail-relay/`.

> **Why you'd do this:** Cloudflare Email Sending is a real transactional API
> (REST + SMTP + Workers binding, Node/Python/Go SDKs) on the Workers Paid plan.
> The usual driver is consolidating domains — e.g. Resend's free tier verifies
> only one domain, so moving off it frees that slot for other projects.

---

## 0. Before you start — know your senders

Inventory **every** place the project sends mail and **how** each one sends:

- **HTTP-capable services** (Node/Python/Go app code) → can call Cloudflare's REST API directly. Easiest.
- **SMTP-only components** (a PDS, a packaged app, anything that only speaks SMTP smarthost) → must reach Cloudflare over SMTP, or go through a relay (see §5).

For each sender note: the **from-address/domain**, the **recipients** (fixed admin inbox vs arbitrary users), and the **transport** it can use. This inventory drives every later decision.

---

## 1. Cloudflare prerequisites

1. Account on the **Workers Paid** plan (Email Sending is beta, gated behind it).
2. The sending domain(s) on **Cloudflare DNS** (works best — records auto-create).
3. **Onboard each sending domain**: dashboard → Compute (Workers) → Email Service → Email Sending → **Onboard Domain**. On Cloudflare DNS it auto-writes MX/SPF/DKIM/DMARC.
   - ⚠️ **DMARC defaults to `p=reject`** at `_dmarc.<domain>`. Safe if the domain sends no other mail; otherwise any unaligned sender from that domain starts getting rejected. Loosen to `p=quarantine` or add the other sender first.
   - A domain can only send once it shows **verified/active**. The from-mailbox need not exist — it's just the envelope-from on an onboarded domain.
   - Onboard a **separate domain per logical sender** if you want clean separation (e.g. product mail from `app.com`, account mail from `accounts.app.com`).

---

## 2. The API token — get this right or lose an hour

**Use a *user-owned* token**, not an *account-owned* (`cfat_`) one.

- Create at **My Profile → API Tokens → Create Custom Token** (NOT "Account → Account API Tokens", and NOT the new JSON-Payload/Terraform creation flow — those produce account-owned `cfat_` tokens).
- Permission: **Account → Email Sending → Edit** (one permission, nothing else).
- Account Resources: **Include → <your account>** (account-scoped — matches the account-level send endpoint, and can send from *any* onboarded domain).

**The trap:** an account-owned `cfat_` token *verifies as valid* (`GET /accounts/{id}/tokens/verify` → active) but the send endpoint rejects it with **`10000 Authentication error`**. If you see that error with a token that "looks fine", this is why.

**Token hygiene:** Cloudflare warns the token can send from any onboarded domain on the account — treat it as a credential. Prefer **one token per service** (independent rotation + clearer audit). The account ID is *not* secret (it's in dashboard URLs).

Smoke-test before wiring anything:
```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/email/sending/send" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"from":{"address":"noreply@<onboarded-domain>","name":"App"},"to":"you@inbox.com","subject":"CF test","text":"it works"}'
```
`"success":true` → good. `10000` → token type/scope (see above). `7003`/`404` → wrong account ID.

---

## 3. HTTP services → REST API (the easy path)

Replace the provider SDK with a small service that POSTs to:
`POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/email/sending/send`
(`Authorization: Bearer <token>`). On Node 20+ use native `fetch` — **no SDK needed**, and you delete the old provider dependency.

Request body (string or `{address,name}` for `from`; string/array for `to`; max 50 recipients):
```json
{ "from": {"address":"noreply@app.com","name":"App"},
  "to": "user@example.com",
  "subject": "…", "text": "…", "html": "…",
  "cc": [...], "reply_to": {...}, "headers": {...} }
```
Worked example: `backend/src/email/email.service.ts` (NestJS, ~30 lines). Guard for unset env so a missing token logs-and-skips instead of crashing.

> No raw RFC822/MIME on the REST API — you must pass structured fields.

**Optimization:** add fixed-recipient admin inboxes (feedback, alerts) as **verified destinations** in Cloudflare — sends to them are free and never count against the daily quota.

---

## 4. SMTP path — Cloudflare's SMTP endpoint

If a sender can speak SMTP and outbound SMTP isn't blocked (see §5 first!):

- Host `smtp.mx.cloudflare.net`, **port 465, implicit TLS (SMTPS)** only. There is **no usable 587/STARTTLS** — the port may accept TCP but serves no SMTP.
- Username: literal `api_token`. Password: the Cloudflare API token (*Email Sending: Edit*).
- From-address must be on an onboarded domain.

⚠️ Many SMTP clients default to 587/STARTTLS — you must explicitly set **both** the port to 465 **and** the TLS mode to implicit. There's usually no port↔TLS cross-validation, so a mismatch just hangs until timeout.

---

## 5. ⚠️ Host egress: many platforms block outbound SMTP

**Check this early — it's the biggest landmine.** Railway (Hobby/Trial/Free), and others, **block outbound SMTP ports (25/465/587/2525)**. Symptom: SMTP sends fail with **`Request timeout`** (not auth errors, not connection-refused). REST API over HTTPS (443) is **not** blocked — which is why HTTP senders sail through and SMTP-only senders die.

If your SMTP-only sender lives on an SMTP-blocked host, options:
1. **Upgrade the plan** (e.g. Railway Pro unblocks SMTP) — simplest, recurring cost.
2. **Run an SMTP→REST relay sidecar** (no cost) — what opnshelf did, see below.
3. **Move the sender off the blocked host.**

### The relay pattern (`services/mail-relay/`)

A tiny Node service (`smtp-server` + `mailparser`): accepts SMTP on the platform's **private network** (internal traffic isn't egress-blocked), parses the message, and forwards it to Cloudflare's REST API over HTTPS.

```
SMTP-only sender ──SMTP (private net, port 2500)──▶ relay ──HTTPS 443──▶ Cloudflare
```

Key points (all learned the hard way):
- **Listen on a non-blocked port** (e.g. 2500 — avoid 25/465/587/2525) so port-based egress filters can't catch it even if it weren't private.
- **Bind to `::` (IPv6)** — platform private networks are IPv6-only.
- Internal-only listener: plaintext, no auth (`disabledCommands: ["AUTH","STARTTLS"]`, `authOptional`). The sender connects with TLS=none and **no password** (some SMTP servers refuse `tls=none` while a password is set).
- Return a **transient (4xx) SMTP code** on upstream failure so the sender re-queues and retries.
- Map parsed `from/to/subject/text/html` onto the REST body (no raw MIME).

### Railway deploy gotchas for the relay
- **`railway up` from a subdir uploads the whole repo** → Railpack may trip on a monorepo. Fix: set the service var `RAILWAY_DOCKERFILE_PATH=<path>/Dockerfile` and write the Dockerfile for a **repo-root build context** with subdir-prefixed `COPY` paths (mirror the pattern in `apps/web/Dockerfile`).
- **An already-running service won't route to a *newly-added* private-network peer until it's redeployed.** After creating the relay, **redeploy the SMTP sender** — otherwise every send times out even though the relay is up.
- Reference another service's secret without copying it: `${{OtherService.VAR}}` (or give each service its own token).

---

## 6. Cutover & verification

1. Set the env vars on each service (REST senders: token + account ID; SMTP senders: smarthost vars). Removing/adding a var typically triggers a redeploy.
2. **Trigger a real send per path** and watch logs end-to-end. For the relay, log on connect + on relay so you can see `connect from …` → `relayed: …` (success) vs `Cloudflare send failed (4xx)` (domain not onboarded / token can't send from it).
3. **Confirm actual inbox delivery**, not just a 2xx from Cloudflare (check spam, From, DKIM).
4. Only then **remove the old provider**: delete its API key first (revokes immediately), then its verified domain (frees the slot). Drop the old `*_API_KEY` env var everywhere (local + every deployed service).
5. Rotate any credentials exposed during the work.

---

## 7. Quick checklist

- [ ] Inventoried every sender + its transport (§0)
- [ ] Workers Paid plan; sending domain(s) onboarded; DMARC `p=reject` understood (§1)
- [ ] **User-owned**, account-scoped, Email-Sending:Edit token; smoke-tested with curl (§2)
- [ ] HTTP senders → REST via `fetch`, old SDK removed (§3)
- [ ] Checked host outbound-SMTP egress **before** choosing SMTP (§5)
- [ ] SMTP-only senders on a blocked host → relay (private net, port 2500, IPv6, TLS=none) (§5)
- [ ] Real send per path verified to the inbox (§6)
- [ ] Old provider key + domain deleted; stale env vars removed; creds rotated (§6)
```
