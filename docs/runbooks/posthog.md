# PostHog instrumentation

Project: [OpnShelf EU, 133952](https://eu.posthog.com/project/133952).
[Product health dashboard](https://eu.posthog.com/project/133952/dashboard/562597).

## Production configuration

The Backend needs `POSTHOG_KEY` set to this project's capture key. `POSTHOG_HOST`
is optional and defaults to `https://eu.i.posthog.com`. The hard gate also requires
`NODE_ENV=production` and `BACKEND_PUBLIC_URL=https://api.opnshelf.xyz` (trailing
slashes accepted). Staging and local environments never report, even with a key.
Configuration was added to the schema and README; deployment variables were not
read or changed as part of implementation. Configure the production Backend during
the approved rollout. Never use a personal source-map upload token for capture.

Web keeps its existing origin gate and `/ingest` EU proxy. Mobile keeps its
production API, release-mode and non-placeholder-key gates. No native dependency
or app-version change is needed; Mobile release route is an approved OTA update.

Backend capture uses the documented [HTTP event endpoint](https://posthog.com/docs/api/capture#single-event),
with a three-second timeout and at most 64 concurrent requests. Events are best-effort:
a failed capture never retries or fails a business operation, and process termination
can lose in-flight events. There is no durable analytics outbox. This is product
telemetry, not an audit ledger or financial count.

## Event contract

All events have `platform=web|mobile|backend`. Existing `source` fields remain
for compatibility; new code uses `surface` for UI location and `provider` for
Trakt/Popfeed. Backend `distinct_id` is the same User DID identified by both clients.
No raw content, usernames, emails, filled-in routes, tokens or request/response
bodies are added. The HTTP success interceptor has an explicit controller/handler
allowlist and copies only categorical values. Add tests when extending that list.

| Event | Owner | Meaning and useful properties |
| --- | --- | --- |
| `account_created` | Backend AuthService | First local account creation; `method=password|google|apple|oauth`. Stable event UUID guards duplicate observations. Replaces client `user_signed_up`. |
| `user_logged_in` | Backend OAuth callback | Successful sign-in, excluding permission replacement. Stable session event UUID. Counts completed OAuth sessions, not restored sessions or bootstrap registration. |
| `integration_permission_changed` | Backend OAuth callback | An authorized permission replacement completed; categorical `integration`. |
| `integration_connection_requested` | Clients | Connection request accepted; `provider`. OAuth can still be cancelled or fail. |
| `integration_connected` | Backend adapters | Credentials/connection successfully saved. |
| `integration_connection_failed` | Backend Trakt callback | Cancellation or failure after owner recovery from state; fixed `reason`/`stage`, no raw error. Invalid unreadable state has no attributable User event. |
| `integration_settings_saved` | Clients | API accepted settings; `provider`, `direction`, `history_scope`, `record_types`. |
| `integration_action_completed` | Clients | API accepted `action=sync|pause|resume|disconnect`; does not assert a finished run. |
| `integration_issue_action_completed` | Clients | API accepted a choice/retry; `provider`, `action`, `record_type`, `all_ratings`. Does not assert successful retry. |
| `integration_sync_prepared` | Backend core | Initial comparison persisted, before transfer batches. |
| `integration_sync_completed` | Backend core | Meaningful completed batch: transfers, backlog, attention change or recovery. `transferred_count`, `remaining_count`, `needs_attention_count`, `duration_ms`, `direction`, `caught_up`. Idle healthy checks are excluded. |
| `integration_sync_failed` | Backend core | Start of a failure episode; categorical error type and HTTP status only. Lock contention is deferred without a failure event. |
| `integration_reconnect_required` | Backend core | Transition requiring reauthorization, including escalation from an existing failure. |
| `integration_sync_recovered` | Backend core | First successful transfer/check batch after a run error; not a promise that every item is resolved. |
| `integration_attention_changed` | Backend core | Attention count changed during a run. |
| `search_performed` | Shared React hook | First completed first-page result for a query/tab visit. Ignores placeholders, refetches and page appends. Only query length leaves the client. |
| `note_saved`, `note_deleted` | Backend HTTP success | Explicit app writes; no Note text or title. Sync writes have their own outcome events. |
| `data_visibility_change_requested` | Backend HTTP success | Migration/default change accepted; `category`, `visibility`. Not a completion event. |
| `notification_permission_responded` | Mobile | OS permission prompt result; `granted`. |
| `notification_device_registered`, `notification_device_removed` | Backend HTTP success | Device registration/removal accepted; no token. Registration includes token refresh. |
| `notification_preference_changed` | Backend HTTP success | Categorical `setting`, boolean `enabled`. |
| `notification_delivery_processed` | Backend worker | `channel=email|push`, `category`, `outcome=accepted|skipped`. Accepted means handed to the provider, not delivered to a human. |
| `notification_delivery_failed` | Backend worker | Terminal retry exhaustion; channel/category only. |
| `notification_opened` | Mobile bridge | Valid internal Notification destination opened; allowlisted section only. |
| `release_notes_read` | Backend HTTP success | Read acknowledgement persisted after history was shown; not every history visit. |
| `account_deletion_requested` | Backend HTTP success | Deletion accepted, including immediate local deletion; `delete_pds_data`. Not proof of background PDS completion. |
| `blog_mirror_settings_saved` | Backend HTTP success | Publication/format settings accepted; URI and name omitted. |
| `blog_mirror_synced`, `blog_mirror_sync_failed` | Backend mirror service | Actual document synchronization result, without the Review text or document URI. |
| `review_published` | Clients | `mirror_requested` replaces misleading `mirrored_to_blog`; actual mirror outcomes are separate Backend events. |

## Identity and privacy

Both clients identify the verified current User when a persisted session is restored,
without reporting another login. Switching between known DIDs resets the SDK identity;
logout/expiry resets it too. Auth callbacks no longer manufacture signup events from
`needsOnboarding`, and permission callbacks do not count as new sign-ins.

Web automatic DOM capture and session recording are explicitly disabled, and Mobile
automatic touch capture is disabled. Manual navigation/product events and exception
capture remain. This avoids relying on generic URL stripping to sanitize replay or
automatic interaction payloads. Re-enabling recording needs a separate synthetic-data
privacy verification of its full payloads, including authentication redirects.
Existing exception scrubbing/fingerprinting and 401/429 exclusions are unchanged.

## Dashboard changes and rollout checks

- [Activation](https://eu.posthog.com/project/133952/insights/l48yuLaJ):
  account created → onboarding complete → first Watch within seven days. No manual
  email step, so externally verified accounts are included.
- [Trakt setup](https://eu.posthog.com/project/133952/insights/OejRB4Bx) and
  [Popfeed setup](https://eu.posthog.com/project/133952/insights/KderT7vo): connected →
  settings saved → prepared. Each filters every step to one provider, so activity
  across different integrations cannot complete the same funnel.
- [Sync health](https://eu.posthog.com/project/133952/insights/1vnCJxjC): failure,
  reconnect and recovery episodes by provider. This is not a per-check failure rate.
- Mobile active users is explicitly labelled Mobile. The two retired Import charts
  remain saved as historical insights and were removed from the current dashboard.
- Original/replacement query definitions and saved identifiers are recorded in
  [the change snapshot](../research/posthog-insights-2026-11-07.json).

These live dashboard changes are already applied; their new event series are empty
until the code deploys and production Backend capture is configured. Existing client
bundles may continue emitting legacy `user_signed_up` or client login events; the new
account-created funnel avoids mixing legacy signup semantics. The Completed sign-ins chart filters `platform=backend`, excluding legacy client
login events during rollout. No historical data was rewritten or deleted.

After the approved deployment, inspect event arrival using ordinary traffic, confirm
DID linking and provider properties, and verify a naturally occurring sync outcome.
Do not publish real public records just to produce analytics evidence. Do not equate
an empty new series with zero real product activity before capture is enabled.

## Verification for this implementation

- `pnpm typecheck` and `pnpm check` passed; existing lint warnings remain.
- `pnpm --filter web run test`: 657 passed, one skipped.
- `pnpm --filter mobile run test`: 652 passed, one skipped.
- `pnpm --filter backend run test`: 1457 passed, 132 skipped. The skipped groups
  include local-database integration suites; no shared database was used.
- `pnpm --filter backend run build` passed, including Prisma and lexicon generation.
- `pnpm generate:api` completed with no OpenAPI/generated-client changes;
  `pnpm --filter @opnshelf/api exec tsc --noEmit` passed.
- `git diff --check` passed.

Source changes were reviewed against `CODING_STANDARDS.md` and the React checklist.
No UI layout or loading-state changes were made. No deployment, Mobile publication,
real-record smoke test, or production event-ingestion test was performed.
