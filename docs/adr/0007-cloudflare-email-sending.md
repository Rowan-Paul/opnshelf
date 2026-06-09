# Send transactional email via Cloudflare Email Sending, not Resend

We send all transactional email — the in-repo feedback notification and the Tranquil PDS account mail (verification, password reset) — through **Cloudflare Email Sending** instead of Resend. The driver is operational, not technical: Resend's free tier allows a single verified domain, and that slot is needed for other projects. Cloudflare's Email Sending (REST API for the NestJS backend, SMTP smarthost for the PDS) lets opnshelf send from its own domains while consolidating onto infrastructure already in use here (Turnstile, DNS).

## Consequences

- **Beta dependency.** Cloudflare Email Sending is in beta and requires the Workers Paid plan. We accepted moving working email onto a beta service to free the Resend domain slot. If deliverability or the beta proves unreliable, the feedback path is a ~30-line service swap and the PDS path is an env-var swap — both reversible.
- **DMARC `p=reject`.** Onboarding `opnshelf.xyz` and `opnshelf.social` auto-creates a DMARC record defaulting to `p=reject`. Safe today (neither domain sent mail before this), but any *future* sender from those domains must be SPF/DKIM-aligned or it will be rejected.
- **Two send paths, one provider.** Backend feedback uses the REST API (`POST /accounts/{id}/email/sending/send`, native `fetch`, no SDK). The Tranquil PDS uses Cloudflare's SMTP smarthost (`smtp.mx.cloudflare.net:465`, implicit TLS) — it must set `MAIL_SMARTHOST_TLS=implicit` and `MAIL_SMARTHOST_PORT=465`, because Cloudflare offers only 465/SMTPS, not the 587/STARTTLS Tranquil defaults to.
