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
