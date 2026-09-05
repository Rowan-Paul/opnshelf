# Mobile OAuth completion uses a single-use handoff code

Status: accepted.

The Mobile App signs in through the backend's PDS OAuth flow in a system
browser session (`WebBrowser.openAuthSessionAsync`). The flow ended with the
backend redirecting to `opnshelf://auth/complete?session=<sessionId>`, where
the value in the link was the Bearer token itself. A custom URL scheme is
first-come, first-served on Android: any installed app can declare
`opnshelf://` and receive that intent, and the OS may deliver the redirect to
the deep-link handler instead of resolving the auth session. Whoever received
that link held a live session.

The verified https App Links from ADR 0022 would let `/auth/complete` be
claimed by the app alone, but switching the redirect to https needs a native
config change (a store build) and would send the session to the web server
whenever the app is not installed. We wanted a fix that ships over the air.

## Decision

The redirect carries a **Mobile Handoff Code** instead of the session, and the
app redeems it with a secret only it holds. The shape is RFC 7636 PKCE, with
one deliberate twist: the backend mints the pair.

1. Before opening the browser, the app calls `POST /auth/mobile/challenge`.
   The backend returns `{ codeVerifier, codeChallenge, expiresAt }`, minted
   with `randomBytes(32)` and `S256` (`base64url(sha256(verifier))`). It stores
   nothing: the exchange only has to compare a hash to a challenge. The app
   keeps the verifier in memory and briefly in SecureStore (Android may render
   `auth/complete` in a fresh process).
2. The app appends `code_challenge` to `GET /auth/login` or `GET /auth/signup`,
   or sends `codeChallenge` in `POST /auth/permissions` and
   `POST /auth/verify-email`. The backend validates it (base64url, 43 chars)
   and carries it in the OAuth `state` payload next to `platform`, never in a
   cookie.
3. At the callback, when the state holds a challenge, the backend mints a
   single-use code bound to `{ sessionId, codeChallenge }` in an in-memory map
   with a 60-second TTL and redirects to
   `opnshelf://auth/complete?code=<code>` (plus the existing `permission`
   marker). The session id never appears in the link.
4. The app calls `POST /auth/mobile/exchange` with `{ code, codeVerifier }`.
   The backend deletes the code on the first attempt whatever the outcome,
   checks the TTL, compares `S256(codeVerifier)` to the stored challenge with
   `timingSafeEqual`, and answers `{ sessionId, did, handle }` or a generic
   400. The app then continues exactly as before.

Why the backend mints the verifier: the app has no CSPRNG and no SHA-256.
Expo 57 installs no `crypto` global, Hermes has no WebCrypto, and `expo-crypto`
is a native module, so adding it would itself force a store build. Issuing the
pair over TLS from Node keeps the client free of crypto code. The backend is
already the party that holds the session, so learning the verifier gives it
nothing new; the property we need is only that the app on the device that
started the flow is the one that finishes it, and a rogue app that captures
the redirect never sees the challenge request, the verifier, or the login URL.

Backward compatibility is explicit in both directions. A callback whose state
has no challenge (an app build that predates this change) still gets the
legacy `session=` link; that branch is marked deprecated in
`AuthController.buildMobileCompleteUrl`. An app talking to a backend that
predates this change gets a 404 from the challenge endpoint, falls back to
starting the flow without a challenge, and keeps handling `session=`.

## Consequences

- The change is OTA-compatible. No native configuration moved, so it ships as
  an EAS Update on the existing channel; `version` in
  `apps/mobile/app.config.ts` is not bumped for it.
- The handoff map is process memory, like the limiters in ADR 0025, and shares
  its trigger: a second backend replica would mint a code on one process and
  receive the exchange on another. Before scaling, move the map to the same
  shared store as the throttler counters. A restart between redirect and
  exchange makes the user sign in again, which within a 60-second window is
  accepted.
- Both anonymous routes are rate-limited to 10 requests per minute per
  tracker (`@Throttle`), so the challenge endpoint cannot be used as a random
  number faucet and the exchange cannot be brute-forced; a wrong verifier also
  burns the code.
- `POST /auth/mobile/exchange` joins `/auth/callback` in
  `PdsMaintenanceGuard`'s list of routes that complete an authentication,
  even though a POST is already blocked in a maintenance window, so the set is
  written in one place.
- The web flow is unchanged: it authenticates through the httpOnly cookie and
  never sees a code.

## Follow-ups

- Remove the legacy `session=` branch once every installed build sends a
  challenge; the deprecation comment marks the spot.
- A verified https App Link for `/auth/complete` would close the remaining
  gap, that a rogue app can at least see that a sign-in happened. It needs a
  store build plus a web fallback page for phones without the app, and is
  deferred until a store release is scheduled for other reasons. When it
  lands, the handoff code stays: the two protections are independent.
