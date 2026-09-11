# ADR 0028: Apple's web callback carries signed state, not a cookie

The Google browser flow protects its callback with a `google_state` cookie: a
random UUID set before the redirect and compared on the way back. Apple cannot
use that shape. Apple requires `response_mode=form_post` whenever the `email`
scope is requested, and we need the email — the backend refuses any signup
whose address the provider has not verified. `form_post` means Apple's browser
issues a **cross-site POST** to the callback, and `google_state` is
`sameSite: "lax"`, so it is not sent. The cookie is not weakened by Apple's
flow; it is simply absent.

So Apple's browser callback carries an HMAC-signed, base64url-encoded payload
in the provider `state` parameter — a nonce plus a timestamp — and the callback
verifies the signature instead of comparing against a cookie. This covers both
places Apple uses a browser: the web app, and the Android app (ADR 0027).

## Considered options

- **`sameSite: "none"` on the Apple state cookie.** The smallest diff, and it
  does fix the cross-site POST. Rejected because it buys a cookie-security
  downgrade for a partial answer: cookies still do not survive an iOS auth
  session, so it solves the web leg and leaves the mobile one needing a second
  mechanism anyway.
- **A server-side map keyed by a random state**, mirroring the Mobile Handoff
  Code. Matches an existing in-repo pattern, but inherits the single-replica
  constraint from ADR 0025 — and unlike the handoff map's 60 seconds, a signup
  state lives 15 minutes, long enough for an ordinary deploy to drop it
  mid-signup.

## Consequences

- **Google keeps its cookie.** With native sign-in handling both mobile
  platforms for Google (ADR 0027), Google's browser leg is web-only, where the
  cookie works correctly. Retrofitting it onto signed state would be churn on a
  path that has no problem. The cost is two state mechanisms across two
  buttons on the same page; the comment at the Apple callback should say why.
- **Do not reuse `serializeOAuthAppState` for this.** That serialiser is plain
  `JSON.stringify` with no signature, which is defensible on the atproto leg
  where `@atproto/oauth-client-node` holds the real CSRF protection in the
  `authState` table. On the provider leg nothing else is guarding, so the
  signature is the protection.
- **The Apple callback is a POST route**, unlike `GET /auth/google/callback`.
  Anything that assumes provider callbacks are GETs — route guards, CSRF
  middleware, request logging — has to be checked against it.
