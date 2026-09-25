# Feedback to GitHub Issues

Both clients send feedback through `POST /feedback`, with or without a session.
The backend saves it first, then creates an issue instead of sending email.

## Configuration

- `FEEDBACK_GITHUB_REPOSITORY`: `Rowan-Paul/opnshelf` (non-secret).
- `FEEDBACK_GITHUB_TOKEN`: dedicated fine-grained personal access token scoped
  to that repository with **Issues: read and write**. Keep it server-side.
  Never use a developer's broad CLI token or put it in a client bundle.
- `FEEDBACK_NOTIFICATION_EMAIL` is no longer used. Cloudflare email credentials
  remain necessary for other transactional notifications.

GitHub's [create issue endpoint](https://docs.github.com/en/rest/issues/issues#create-an-issue)
is called with a ten-second timeout. Issues receive `needs-triage` and either
`bug` or `enhancement`. Ensure these labels exist before enabling delivery.

The title comes from the first line of the feedback, truncated to 160 characters.
The body contains the text, sanitized page location when supplied, and feedback
ID. It does not attach the submitting account. User-entered text is still public:
the notice in both clients asks users to omit personal information and secrets.

## Rollout and verification

Deploy the Web disclosure and publish the Mobile disclosure as an approved OTA
update before enabling GitHub delivery. The Mobile version is unchanged; no new
store build is required. Older clients cannot display the new notice, so account
for their continued use when enabling public routing.

Apply the anonymous-feedback database migration before deploying the backend.
All deployments, shared-database migrations and OTA publication require operator
authorization. Merely adding the checked-in examples does not enable delivery.

Use mocked GitHub calls in local tests. For a live check, configure a sandbox
repository and submit synthetic feedback; confirm its issue and labels. Do not
backfill old private feedback into public issues.

## Failed delivery

If GitHub rejects or times out, feedback remains saved and the user receives the
normal receipt. Logs include the feedback ID and HTTP status when available,
without the token or response body. Missing configuration also leaves feedback
in the database. There is no email fallback or automatic retry.

Use the feedback ID to locate the database record and check GitHub before any
manual retry: a timed-out create may already have produced an issue. Resolve
configuration, token permissions/expiry or rate limits before retrying. Historical
submissions made before the public disclosure must stay private.
