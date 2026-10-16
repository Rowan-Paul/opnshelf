# Privacy Alpha reference PDS verification

Run `pnpm test:privacy-reference` with Docker running (Linux or macOS/OrbStack).
It starts the reference Spaces image pinned below with only host-loopback port
3213 published. A synthetic PLC resolver on 3214 shares its isolated container
network namespace; that resolver is never published to the host. It creates disposable publisher/user
accounts and publishes this checkout's Core and Space declarations to the local
reference PDS. The resolver only stores synthetic PLC operations; it does not
validate PLC updates and is not a PLC implementation test.

The reference server and its OAuth implementation are unmodified. The check runs
PAR, loads the consent page, signs in through its CSRF-protected provider API,
verifies declined consent, exchanges a PKCE code, and uses DPoP-bound access tokens
for Public → Private → Public operations across all six collections. Production
capability parsing must accept the actual issued owner-qualified scopes. Tokens
and signing keys remain in memory/stdin and are never printed. Containers and
synthetic storage are removed on completion or interruption. No personal account,
public relay, hosted database or production namespace is used.

CI runs this gate for Privacy/auth-scope/declaration changes and includes its
result in CI result. Browser/native presentation still needs separate client
verification through [local scenarios](development-sessions.md) and the
[real local stack](spaces-local-trial.md): the synthetic provider API check does
not demonstrate native system-browser presentation.

## Standalone account-session wire check

Run `backend/scripts/privacy-reference-smoke.ts` only against a disposable local
reference Spaces PDS with a local PLC, open synthetic account registration, and
no real user data. `PRIVACY_REFERENCE_PDS_URL` defaults to `http://127.0.0.1:3203`
and the script rejects non-loopback hosts.

```sh
NODE_ENV=test DATABASE_URL=postgresql://localhost:5432/opnshelf_codegen pnpm --filter backend exec ts-node --transpile-only scripts/privacy-reference-smoke.ts
```

The standalone script creates a synthetic account, generates its credentials in memory,
and verifies all six collections across Watches, Library, Notes and Lists:
Public → Private → Public, preserved record values and rkeys, private put/get/
applyWrites, standard private deletion and public conditional deletion. Destroy
the disposable PDS afterward to remove its synthetic account and Spaces.

This is wire compatibility verification using an account session. It does not
verify the separate OAuth browser authorization flow; test that through Privacy
settings on both Web and Mobile before release.

Verified 2026-10-07: all six collections passed against
`ghcr.io/bluesky-social/atproto:pds-spaces-alpha` at digest
`sha256:1cf9349e9f0e89789784569fed376cd647742ea7c368948625f44779ba03f150`.

## Local application verification (2026-10-07)

The disposable Tranquil stack at `http://127.0.0.1:3000/settings/privacy` was
verified with the existing local test account. Web completed the integrated
Private authorization, Notes visibility change, and migration of the existing
Favorites List. The owner still saw Favorites on their profile; signed-out List
summaries excluded it and its detail endpoint returned 404. The iPhone 18 Pro
simulator (iOS 27), route `/settings/privacy`, completed Library Public → Private
→ Public with publication confirmation. Settings showed all four categories,
the new-List default and per-List choices. The retired Settings cleanup cleared
its local flags after obtaining the deletion grant.

These checks complement the six-collection reference wire test and PostgreSQL
migration tests; they do not claim production deployment or reference-PDS OAuth
browser verification. Local catalogue discovery remains limited without a TMDB
API key. The shared browser's inspection API timed out; its page was inspected
and operated through native computer control instead.

## Reference OAuth verification (2026-10-07)

A separate disposable-account check exercised PAR, the reference authorization
page, sign-in and consent APIs, PKCE token exchange, and DPoP-authorized
Public → Private → Public operations for all six collections. It found and
fixed two gaps hidden by the account-JWT wire test:

- The reference consent screen resolves Space declarations even when the scope
  names collections explicitly. `spaces/lexicons/` now supplies those declarations.
- Issued scopes resolve implicit self authority to `authority=<account DID>`.
  Capability checks now accept that exact owner and reject other authorities.

The successful check used the reference PDS's `PDS_LEXICON_AUTHORITY_DID` override
pointing at a synthetic local publisher containing those declaration records.
The reference implementation, validation and authorization were unchanged.
This proves the protocol flow with local publication; it does **not** verify
production namespace resolution or the visual reference consent screen. Web
and Mobile visual checks above still used Tranquil.

**Rollout dependency:** publish the five Space declarations and verify public
Lexicon resolution before enabling the alpha. This is a separately approved
publication step, not a PDS deployment. Do not publish through the existing
script until the operator has approved the declaration set.

The follow-up OAuth check also created a disposable retired Settings Space and
deleted it using only the cleanup grant (`manage=delete`), with the corrected
`xyz.opnshelf.privateSettings` collection declaration. This passed.
