# PostHog audit — 7 November 2026

## Implementation follow-up

The findings below record the pre-change audit. The follow-up implementation adds
production-gated Backend outcomes and authoritative account creation, restores client
identity on authenticated hydration, shares deduplicated search tracking, standardizes
platform fields, adds the missing categorical feature events, and disables automatic
DOM/touch capture and Web replay. The live dashboard has been corrected with new
provider-specific setup and health charts; historical Import insights remain saved.
See [the instrumentation runbook](../runbooks/posthog.md) for current semantics,
rollout requirements, event coverage and the live insight links. Backend capture still
requires production `POSTHOG_KEY` configuration and deployment; neither was performed.

## Scope and evidence

Audited the Web App, Mobile App, Backend, shared API helpers, source-map configuration,
release workflow, existing analytics tests, and live PostHog taxonomy and saved insights.
Live project: [OpnShelf, EU project 133952](https://eu.posthog.com/project/133952).
The taxonomy snapshot covers the preceding 30 days; absence there means no recent
observed event, not proof that an event never existed. Source findings describe this
checkout, which may differ from deployed bundles. No credentials or deployed variables
were read, and no live settings, dashboards, flags or insights were changed.

## Findings, in priority order

### P1: Sync had no product analytics; background outcomes remain invisible

Before this change, neither client's `components/integrations/IntegrationSyncManager.tsx`
had capture calls. The live event taxonomy has no Trakt, Popfeed, integration or sync
product events. Both providers share the management component, including onboarding.
A failed mutation is reported through the common MutationCache, but a successful
request, abandoned setup, pause, disconnect, settings change or conflict choice was
not measurable as product behavior.

This change adds the same four events to both clients, after API success:

| Event | Properties | Meaning |
| --- | --- | --- |
| `integration_connection_requested` | `provider`, `platform` | The API accepted a connection request; an OAuth redirect may still need completion. |
| `integration_settings_saved` | `provider`, `platform`, `direction`, `history_scope`, `record_types` | Settings were accepted, including initial enablement. |
| `integration_action_completed` | `provider`, `platform`, `action` | A sync, pause, resume or disconnect action was accepted. Sync acceptance does not mean a background run finished. |
| `integration_issue_action_completed` | `provider`, `platform`, `action`, `record_type`, `all_ratings` | A retry, ignore, restore, match, link or version choice was accepted. A retry does not prove recovery. |

No record IDs, remote usernames, media titles, notes, Reviews, OAuth URLs, candidate
keys or raw errors are added. Existing production gates and error reporting remain.
Events use submitted mutation variables rather than mutable form state.

**Still missing:** authoritative connection completion/failure, permission-grant outcomes,
background run results, transferred counts, new Needs attention items, reconnect
transitions and recovery. `backend/src/integrations/integration-sync.service.ts` owns
these outcomes, including `lastSuccessAt`, item-level errors and deferred work. There
is no Backend PostHog SDK or capture path. Polling status in the clients cannot measure
runs that finish while the app is closed and would duplicate runs across devices.

**Follow-up:** add a production-only Backend analytics boundary, identify by the same
User DID as the clients, and instrument the shared core (ADR 0051), once per meaningful
transition. Use `integration_connected`, `integration_connection_failed`,
`integration_sync_completed`, `integration_sync_failed`,
`integration_reconnect_required` and `integration_sync_recovered`. Include provider,
direction, duration, aggregate transfer/attention counts and registered error codes.
Do not emit every idle check or every synced record. A run with `lastSuccessAt` can
still leave item-level failures, so expose attention/remaining counts and distinguish
successful checking from fully caught up. Keep analytics best-effort and outside the
critical write path; failure to ingest analytics must never fail a sync.

### P1: Signup and sign-in events do not consistently represent account creation

- Web `routes/signup.tsx` captures password signup without identifying the newly
  created DID. `lib/auth-context.tsx` does not identify on `/auth/me` hydration.
  An interrupted verification/OAuth journey can therefore leave signup anonymous.
- Web Apple and Google signup routes emit `user_signed_up` before Core OAuth;
  `routes/auth/complete.tsx` then emits another signup with `method: oauth` whenever
  `needsOnboarding` is true. Returning incomplete accounts can emit signup again.
  Unique-person funnels may tolerate some repeats; total signup counts and method
  breakdowns do not have reliable creation semantics.
- Mobile `lib/auth-context.tsx` emits `user_signed_up` for PDS registration but
  `completeSession` emits only login. First-time external OAuth Users therefore
  lack the corresponding Mobile signup event.
- Web auth completion and Mobile `completeSession` also serve permission
  reauthorization. Unconditionally emitting login there inflates login activity
  with permission changes.
- Restored sessions do not reassert analytics identity from the authenticated User
  on either client. SDK persistence normally retains it, but cleared analytics
  storage with a surviving application session leaves authenticated use anonymous.

**Follow-up:** emit account creation authoritatively on the Backend, once, with the
actual creation method; separate sign-in completion from grant completion. Identify
from the verified current User in both clients, without emitting a login on every
hydration. Do not send form values or email addresses. Coordinate replacement of
client signup events to avoid counting both sources.

### P1: Saved analytics contain stale import events and a gated activation step

The [Product health dashboard](https://eu.posthog.com/project/133952/dashboard/562597)
includes two saved insights referencing events absent from both this checkout's
capture calls and the live 30-day taxonomy:

- [Trakt import terminal status](https://eu.posthog.com/project/133952/insights/IyKm1L1v)
  references `trakt_import_finished`.
- [Trakt import health — preview to completion](https://eu.posthog.com/project/133952/insights/WcNbILeM)
  references `trakt_import_previewed`, `trakt_import_started`, `trakt_import_finished`.

These cannot monitor current Sync. Retain historical import analysis separately and
add a provider-based integration setup funnel plus authoritative background health
when those events exist.

The [activation funnel](https://eu.posthog.com/project/133952/insights/l48yuLaJ)
requires `email_verified` between signup and onboarding. External-PDS Users are
verified upstream and skip this action (`backend/src/auth/auth.service.ts` documents
that behavior). They cannot complete that exact funnel even when activated.
Use signup → onboarding → first value action for everyone; measure manual email
verification separately for accounts that need it.

The saved Active users insight uses `Application Opened`, so it represents Mobile
activity rather than all-platform activity. Rename it or define an all-platform
active-user measure from agreed value events. These are definition problems, not
proof of a traffic regression.

### P2: Search events can describe stale results and overcount requests

Web search, command search and list-item picker capture from effects keyed by query
and result objects while using `keepPreviousData`. The old result object can be
associated with a newly changed query before the new response arrives, and a
refetch can produce another event. Mobile search also captures in a result-driven
effect; its dependencies include query length rather than the complete query.
Pagination/result-count changes can generate extra events for the same search.

**Follow-up:** define a search as a completed response for a distinct query/tab/surface,
exclude placeholder data, and deduplicate against the actual submitted query.
Keep query text out of analytics. Test rapid query changes, equal-length queries,
refetches, pagination and empty results.

### P2: Other feature adoption is incompletely represented

There are no dedicated product events for Notes, Data Visibility changes, notification
permission/device registration and preferences, Release Notes engagement, account
deletion, or Blog Mirror connection/settings. Exceptions cover many failed writes,
but do not establish adoption or successful delivery. Existing `review_published`
records requested mirroring as `mirrored_to_blog`, while Bluesky reporting uses the
actual `posted` result: those properties have different outcome semantics.

**Follow-up:** prioritize `note_saved`, `data_visibility_changed`, notification opt-in
and preference events, and Blog Mirror outcomes. Use categorical settings only, no
content or recipient details. Instrument notification delivery on the Backend and
notification opens in the Mobile bridge. Do not add a capture call to every button.

### P2: Taxonomy and platform dimensions need a shared contract

Names generally use consistent snake_case, but platform is variously expressed as
`platform`, `source`, or only SDK metadata. Follow events use `source` as the surface
on Web and as the platform on Mobile. Generic events such as list changes and Review
publishing often omit an explicit platform. This makes a reusable cross-platform
breakdown harder and risks mismatched dashboard filters.

**Follow-up:** use `platform` for Web/Mobile/Backend, `surface` for UI location, and
`provider` for integrations. Preserve existing fields while migrating saved insights.
Maintain a small event/property contract and tests that assert success-only capture,
privacy properties and client parity. Existing tests focus heavily on exception
handling and environment isolation; product capture assertions are less systematic.

### P2: Automatic capture needs a separate payload privacy check

Web explicitly strips current URL/path from non-pageview events and referrer from
all events, and sends only origin/route section for pageviews. Mobile manually sends
section-level screens. Mutation failures omit raw server messages and validate
request IDs, categorical codes, route sections and release SHAs. These are sound
controls.

However, URL stripping is not a blanket scrubber: automatic DOM/touch capture,
exception stack frames and replay payloads can have other fields. Mobile enables
`captureTouches`; Web enables remote-configurable SDK behavior and starts exception
autocapture. The shared `preparePostHogEvent` filters rate limits and names exceptions,
not all possible personal data. This audit did not inspect raw customer replay or
exception content, so it does not establish a leak or certify replay masking.

**Follow-up:** verify actual SDK payloads with synthetic data for authentication,
Notes, private Lists and integration permission redirects. Explicitly mask or exclude
sensitive surfaces in replay/automatic capture where needed. Do not broaden capture
to raw input or error messages to diagnose the other findings.

## Coverage inventory

| Area | Web | Mobile | Assessment |
| --- | --- | --- | --- |
| Page/screen navigation | Manual section-level `$pageview` | Manual section-level `$screen`, lifecycle | Present; deliberately coarse for privacy. |
| Auth and activation | Signup, login, email verification, onboarding | PDS signup, login, email verification, onboarding | Present with identity/counting gaps above. |
| Watches | `watch_logged`, scope/date kind and optional batch count | Same | Success capture; zero-item batches excluded. No automatic import/sync outcome coverage. |
| Ratings and Reviews | Save/publish/like | Same | Present; not a complete edit/delete lifecycle. |
| Lists, Watchlist, Favorites | Create and item changes | Same | Present; list settings/deletion not separate product events. |
| Library | `library_changed` | Same | Present in code; not in recent live taxonomy. |
| Search/discovery | Search, opened cards/command items | Search, opened cards | Present with search semantics above. |
| Social | Follow/unfollow, activity viewed | Same | Activity views guarded against pagination/refetch duplicates. |
| Sharing/providers | Share completion, provider open | Same | Present; clipboard success is also called share completion. |
| Feedback | Category-only submission | Same | Present. |
| AT Store | Viewed/clicked/dismissed/composer/published | Same | Present in code; only viewed appears in recent taxonomy. |
| Mobile acquisition prompts | Link opened/dismissal | Not applicable | Present in code. |
| Sync/integrations | Four action events added | Same four added | Backend completion and recovery still missing. |
| Exceptions | MutationCache, ErrorBoundary, autocapture | MutationCache, SDK autocapture | 401 omitted from mutation reports; 429 dropped by send hook under ADR 0031. |
| Feature flags/experiments | No SDK flag calls found | No SDK flag calls found | Live non-deleted feature-flag list is empty. |
| Backend analytics | None | Not applicable | Background work and server outcomes not tracked. |

## Configuration and delivery

- Web initializes only on `opnshelf.xyz` with a configured key; SDK is lazily loaded
  and calls are queued. Ingestion proxies through `/ingest` to EU.
- Mobile initializes only outside development with the production API and a real,
  non-placeholder key. Staging intentionally sends no analytics (ADR 0021).
- Web disables automatic pageviews and uses the root route tracker. Same-section
  navigation is intentionally not a new pageview. Mobile disables automatic screens.
- Both clients reset identity on explicit logout; Mobile also resets on expiry.
- Web build source maps use the Rollup plugin, private upload and a public-map gate.
  Mobile uses the Expo/Metro integration, EAS release tags and release workflow OTA
  upload. This audit checked configuration, not a new deployed symbolication test.
- Live context reports session replay enabled and project exception autocapture
  disabled. The clients explicitly enable exception capture, and `$exception` exists
  in recent taxonomy, so the project label alone is not evidence of broken errors.
- No local environment, production secret values, replay masking configuration,
  billing limits, retention settings or ingestion-drop rates were inspected.

## Recommended order

1. Ship the small client integration instrumentation in this change; verify arrival
   after deployment without writing real public records solely for analytics testing.
2. Add production-gated authoritative Backend integration outcomes and a provider
   setup/health dashboard, replacing stale import monitoring for current Sync.
3. Fix account-creation identity/semantics and the activation funnel together.
4. Correct search counting and standardize platform/surface fields.
5. Add selected missing feature-adoption events and synthetic payload privacy checks.

PostHog's [product analytics best practices](https://posthog.com/docs/product-analytics/best-practices)
recommend explicit growth events, a proxy and consistent naming. The Backend outcome
recommendation also follows the connected `posthog:instrument-product-analytics`
workflow. Application privacy and environment constraints take precedence over its
generic suggestions to capture login form fields.

## Validation of this change

- `pnpm typecheck` — passed for all workspaces.
- `pnpm check` — passed; existing Web/Backend warnings remain.
- `pnpm --filter web run test` — passed (655 tests, one skipped before the final
  capture assertions and rejection test were added).
- `pnpm --filter mobile run test` — passed (651 tests, one skipped).
- `pnpm --filter web exec vitest run src/components/integrations/IntegrationSyncManager.test.tsx`
  — final focused run passed (27 tests), including all four payloads and no
  completion event on rejected actions.
- `git diff --check` — passed.

Reviewed the component changes against `CODING_STANDARDS.md` and the React
best-practices checklist: capture stays in mutation callbacks, no extra effects,
subscriptions, dependencies, renders or layout changes. No simulator/browser visual
check was needed because rendering and interaction layout were unchanged. Live
arrival of the new events is unverified until deployment. Mobile changes are JavaScript
only and require an approved OTA release; no app version bump or release was made.
