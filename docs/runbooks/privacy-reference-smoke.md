# Privacy Alpha reference PDS verification

Run `backend/scripts/privacy-reference-smoke.ts` only against a disposable local
reference Spaces PDS with a local PLC, open synthetic account registration, and
no real user data. `PRIVACY_REFERENCE_PDS_URL` defaults to `http://127.0.0.1:3203`
and the script rejects non-loopback hosts.

```sh
NODE_ENV=test DATABASE_URL=postgresql://localhost:5432/opnshelf_codegen pnpm --filter backend exec ts-node --transpile-only scripts/privacy-reference-smoke.ts
```

The script creates a synthetic account, generates its credentials in memory,
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
