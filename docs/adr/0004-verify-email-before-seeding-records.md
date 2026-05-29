# ADR 0004: Verify email before seeding records, instead of disabling the PDS verification gate

Accounts created on our Tranquil PDS cannot write records until a notification channel (email) is verified — the PDS raises `AccountNotVerified` ("You must verify at least one notification channel before creating records"). Because opnshelf eagerly seeded a profile record + default lists the instant an account was born, every native signup failed that write. We chose to **keep the gate on** and split signup into create-account → verify-email → *then* seed records and start onboarding, rather than flip the gate off.

## Why

Tranquil exposes `server.disable_account_verification_gate` (env `DISABLE_ACCOUNT_VERIFICATION_GATE`), which would make the error vanish with a one-line config change and zero app code. We rejected that. The gate's anti-spam value is largely redundant for us — opnshelf is already the sole gatekeeper for account *creation* (captcha + single-use invite; the PDS is invite-only) — but the gate also guarantees every account has a **verified, recoverable email**, and ATProto account recovery leans on that. Disabling it would quietly give that up for the whole instance. Keeping it and adding a verification step preserves the recovery guarantee and keeps opnshelf honest about the email it collects.

## How

- `createAccount` already auto-sends the signup code (`enqueue_signup_verification`). opnshelf no longer seeds at signup.
- New backend `POST /auth/verify-email { code }`: restores the caller's credential session, reads the email via `getSession`, calls `com.atproto.server.confirmEmail({ email, token: code })`, and on success seeds the profile + default lists. `POST /auth/resend-verification` → `requestEmailConfirmation`.
- Verification status is **mirrored** in our DB as `User.emailVerifiedAt` (mirroring the `onboardingCompletedAt` convention) so `/auth/me` stays a pure DB read. External OAuth users (e.g. `bsky.social`) are set verified on first callback so they are never gated; only native unverified accounts are.
- Web: email verification is the **first gated step inside `/onboarding`**, not a standalone route. `register` → `/onboarding`, which renders the verify step while `needsEmailVerification` and structurally blocks the rest until it flips. A separate `/verify-email` route was tried first but the global `needsOnboarding` redirect in `__root.tsx` yanked it straight to `/onboarding`, so folding it into onboarding is the only race-free placement.

## Scope

Web register flow only. Native mobile signup (`prompt=create` via the OAuth callback) hits the same gate and is tracked separately (#130, under the mobile rework epic #89); the backend verify/resend endpoints are path-agnostic so mobile can reuse them.
