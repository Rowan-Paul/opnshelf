# ADR 0015: Devices are client-identified sessions, claimed by header

Users need to see what is signed in to their account and revoke it, but an `AuthSession` row carries no
identity beyond its own opaque id. Rather than add a device registry, each client sends the platform's
own installation id (`getIosIdForVendorAsync` / `getAndroidId` on mobile, a `localStorage` UUID on web)
plus a display name and platform on every request, and the `AuthGuard` stamps those onto the session row
the first time they differ. A **Device** is therefore a session that has claimed an identity, not a
separate entity, and one session per `(userDid, deviceId)` stays alive: a stamp deletes any older sibling,
so signing in again from the same install revokes that install's previous token instead of leaving it
valid for the remaining 14 days.

The device id is a grouping and addressing key only. It arrives from the client and is never trusted for
authorization: every read and every revoke is scoped by `userDid`, and the response omits `AuthSession.id`
because that string is the live bearer token.

## Considered options

- **A `Session` entity instead of `Device`.** Honest about the data — one physical phone can hold several
  sessions — but it pushes that accounting onto the user, who then asks why their iPhone appears three
  times. Rejected in favour of takeover, which makes the one-row-per-install claim true.
- **A self-minted UUID in SecureStore** rather than the platform vendor id. Simpler, but iOS and Android
  both clear app keychain storage on uninstall, so every reinstall would mint a new Device.
- **Storing IP and showing an approximate city.** The strongest signal that a session isn't yours, at the
  cost of a geo-IP provider, PII on every session row, a privacy policy rewrite, and wrong answers on
  mobile networks and VPNs. Rejected; "last used" carries most of the signal for none of the cost.
- **Threading the device id through the OAuth `state`** so `/auth/callback` records it at session
  creation. Correct at birth, but it touches three login paths and leaves every session already in
  production permanently unnamed. The header stamp names them on their next request instead.

## Consequences

- `deviceId` is `NOT NULL`, backfilled with `gen_random_uuid()` by a hand-edited migration, so sessions
  that predate this work are addressable and revocable. They read as "Unknown device" until their client
  stamps a real id.
- The invariant is enforced by the stamp's `deleteMany`, not a unique index. Two simultaneous first-stamps
  from one install could leave two rows; that needs two live tokens for a single install, which the one
  SecureStore slot rules out.
- Right after a re-login, a request still in flight with the superseded token gets a 401 and trips
  `onUnauthorized`, sending that device to the login screen once.
- Web device identity is per browser profile. A private window or cleared site data is a new Device, and
  no amount of work short of fingerprinting changes that.
