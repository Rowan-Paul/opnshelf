# ADR 0031: Failed mutations are reported to PostHog as exceptions

Both clients wire a TanStack Query `MutationCache` that reports every failed mutation to PostHog through `captureException`. The shared `describeMutationFailure` helper in `packages/api` builds the report, so Web and Mobile send the same shape: a synthetic `MutationFailedError` whose message is the mutation key plus the HTTP status, with `mutation_key`, `http_status`, and `error_name` as properties. A 401 is not reported, because session expiry is already handled by the unauthorized flow. Each client keeps its existing environment gate, so only the production origin and the production API report.

PostHog's exception autocapture only sees uncaught errors and unhandled rejections. Every mutation in this repo catches its error and shows a toast, so a write that failed on every attempt produced no telemetry at all. The avatar upload limit in #283 returned 400 for every User for weeks and was found by hand. One cache-level hook covers every mutation, present and future, and relies on the existing rule that mutations carry stable array keys.

The report is categorical on purpose. The server message and the original error stay out of the event: validation messages can echo what the User typed, and PostHog events already strip URL fields for the same reason. The cost is that a report says which mutation failed and how, not why; the backend logs carry the why.

## Amendment: exclude rate-limit exceptions from capture

Rate-limit errors exhausted the monthly captured-error allowance. Both clients
now drop these exceptions in their shared PostHog `before_send` hook, covering
manual mutation reports, error boundaries, and automatic exception capture.
The filter matches HTTP 429 report metadata, `ThrottlerException` types, and
the explicit `Too Many Requests` message (with or without its
`ThrottlerException:` prefix). It checks every exception in the cause chain,
including rate-limit failures wrapped by React rendering errors.

Other exceptions and ordinary analytics events remain reportable. Rate limiting,
retry behavior, and user-facing errors remain unchanged; backend request logs
remain the source for investigating throttling. This deliberately trades
PostHog visibility into rate-limit failures for capacity to capture other bugs.

## Amendment: fingerprint reports by message

Every report is created on the same line of `describeMutationFailure`, so
PostHog's stack-based grouping filed all mutation failures under one issue: a
`trakt-sync/issues/resolve` 400 reopened the resolved
`shows/124101/markShowWatched` 500. Reports now set `$exception_fingerprint`
to their message, so each mutation key and status gets its own issue, as the
message was always meant to provide.


## Amendment: diagnostic fields for investigating another User's failure

"The backend logs carry the why" only held if a report could be matched to its
log line and the log line said why. Six `auth/verify-email` 400s and a
`popfeed-sync/configure` 409 could not be explained without asking the User to
reproduce them. Reports now also carry `request_id`, `error_code`,
`api_operation`, `route` and `release`:

- The backend gives every request an `X-Request-ID` (`common/request-id.ts`)
  and logs failures as `METHOD /route/template request_id=<id> -> <status>
  code=<code>`. The ID is generated server-side; an inbound header is ignored.
- `code` is a registered, categorical reason from `common/error-codes.ts`
  (for example `EMAIL_CODE_EXPIRED`, `SYNC_BUSY`, `VALIDATION_FAILED`).
  `AllExceptionsFilter` forwards only registered codes, so a code never echoes
  input. Add a code where the backend already distinguishes a case.
- `api_operation` is the method plus the OpenAPI path template (`/users/{did}`,
  never the filled-in path). `route` is the first path segment, the same
  granularity as pageview and screen events. `release` is the client build's
  commit SHA.

Every field is checked against a strict shape in `describeMutationFailure`
and dropped when it does not match, so tokens, verification codes, email
addresses and request bodies stay out. The message and fingerprint are
unchanged, so existing PostHog issues keep grouping as before.

## Amendment: diagnostics for failures without an HTTP response (#758)

The shared API client records only whether it constructed a Request and received
an HTTP Response. These boundaries do not prove the server received a request.
Mutation reports carry `request_created` and `response_received` as booleans,
or null for errors outside the API client. `failure_reason` is one of `http`,
`aborted`, `timeout`, `network`, or `unknown`. Only exact known transport messages
and abort/timeout names are mapped locally; arbitrary messages stay unknown.
Neither raw error messages nor request/response bodies are sent. Legacy failures
thrown as primitive strings cannot carry the boundary flags; those remain null
and the reason remains unknown.

Mobile also records `app_state_at_start`, `app_state_at_failure` and
`app_backgrounded_while_pending`, distinguishing a failure after a pending
mutation crossed a background transition from a request started in the
foreground. States are restricted to active, inactive, background and unknown.
Each pending mutation's lifecycle listener is removed on success or failure.
A paused mutation retains its listener until it settles, so backgrounding while
paused remains observable.
These diagnostics change no retries, requests, error handling or fingerprints.
Web uses the shared transport diagnostics; native app lifecycle fields apply
only to Mobile. This diagnostic patch does not establish the cause of #758.
