# ADR 0027: Provider sign-in is native in the app, browser on the web

Google signup has been web-only on purpose: a Google button inside the iOS app
trips App Store guideline 4.8, which requires an equivalent Apple option
alongside it. Adding Sign in with Apple removes that blocker, so the question
stopped being "how do we add Apple" and became "where does provider sign-in
happen at all".

We take the credential from the operating system wherever the OS offers one,
and fall back to the browser everywhere else:

| | iOS app | Android app | Web |
|---|---|---|---|
| Apple | native | browser | browser |
| Google | native | native | browser |

Apple is browser-based on Android because `expo-apple-authentication` is
iOS-only. Omitting it there was the obvious alternative — Play has no
guideline 4.8 — but someone who created their account with Apple on an iPhone
and then switched to Android would have had no way into the app at all. That
is an account lockout, not a missing nicety, and the Android app already knows
how to open a system browser and redeem a **Mobile Handoff Code** (ADR 0026).

A native credential arrives as a signed **Identity Token** from the OS, with no
redirect anywhere. The app posts it straight to the backend, which forwards it
to the PDS exactly as the browser flow does. So the two paths converge one step
in, and there is only ever one authentication protocol to reason about.

## Considered options

- **Browser-redirect for every client**, reusing the existing Google shape. One
  code path, ships over the air. Rejected because it spends the whole cost of
  guideline 4.8 compliance and then declines the payoff: the user still gets
  bounced out to a browser to press a button their phone could have answered
  with a fingerprint.
- **Native everywhere, including Apple on Android** via a third-party bridge.
  Rejected: the bridges wrap the same web flow, so it is indirection over the
  thing we would be doing anyway.

## Consequences

- **This cannot ship as an EAS Update.** Native Sign in with Apple needs the
  `com.apple.developer.applesignin` entitlement, which regenerates the
  provisioning profile — the same footnote `associatedDomains` already carries
  in `apps/mobile/app.config.ts`. A store build was already required for other
  reasons (ADR 0018), so this is a scheduling constraint, not a new class of
  problem.
- **Apple needs two audiences, and they must share a `sub`.** A native iOS
  identity token's `aud` is the bundle identifier; the browser flow's is the
  Service ID. Apple's user identifier is scoped to the developer team and is
  only consistent across the two when the Service ID is configured with the
  primary App ID as its primary app. If that grouping is wrong, the same person
  gets one account on iPhone and a different one on the web, because identity
  matching is on `(provider, subject)` alone and never on email. Verify the
  grouping in the Apple Developer console before trusting any test result.
- **Google needs no audience change.** The native SDK is configured with the
  web client id as its `serverClientId`, so the identity token's audience stays
  the single client the PDS already validates against. Native iOS and Android
  OAuth clients still have to exist in the Google Cloud project for the SDK's
  own sake; they just never appear in a token audience.
- **The native path needs its own endpoints.** The browser flow parks its PDS
  registration token in a `google_pending` cookie; a native client has no
  cookie and should not be handed one. The native endpoints return the pending
  registration in the response body instead, and the app renders its own handle
  picker rather than opening the web one — mobile onboarding parity is already
  the standing commitment (ADR 0006). New routes mean the API-client gate:
  `pnpm generate:api` and a committed `openapi.json`.
- **A returning user still passes through the browser once.** When the PDS
  recognises the provider identity it answers with a redirect to its own
  consent or TOTP screen, which is a web page. Skipping it would mean Opnshelf
  minting its own atproto tokens, which is the thing the OAuth model exists to
  prevent. In practice consent is remembered, so the bounce is interactive only
  the first time, and on every sign-in for accounts with TOTP.
