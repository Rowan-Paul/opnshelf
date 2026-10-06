# Private Settings local trial

The first integration stores only `timeFormat`. It is disabled by default.
Read ADR 0045 for data ownership and failure behavior. Use disposable accounts
and databases. Staging shares the production PDS and must not be used here.

## Run the application normally

1. Apply the checked-in Prisma migration to a **local disposable** application
   Postgres with an explicitly supplied `DATABASE_URL`, then run
   `pnpm prisma:generate`. Never use the hosted URL from `backend/.env`.
2. Enable `ENABLE_ATPROTO_SPACES=true` on the backend and on the Spaces-capable
   Tranquil PDS. Supply the local backend/frontend/PDS URLs using the normal
   OAuth configuration. The user's DID and PDS must resolve from the backend.
3. Sign in, open Settings → Preferences and connect Private Settings. Consent
   requests the narrow Space scope in addition to the cumulative existing
   permissions and warns that other devices must sign in again.
4. Save the current time format, change it, and reload. Check it on the other
   client after sign-in. Delete the private copy and confirm it stays missing
   until explicitly saved. Disconnect and confirm ordinary settings still work.
5. Repeat with denied consent, an unsupported PDS, revoked access and a PDS
   outage. No failed remote write should update the local value or report success.

The OAuth library owns DPoP and automatic access-token refresh. This owner-only
flow needs no delegated Space read credential. No record is written publicly,
and the experimental collection is not part of the public Core permission set.

## Focused local UI fixture

`backend/test/spaces-playground.cjs` can run through the Tranquil fork's ignored
`manual::spaces_playground` test. That test must support the
`SPACES_PLAYGROUND_SCOPE` and `SPACES_PLAYGROUND_RUNNER` overrides. It sends a
synthetic OAuth account to the runner over stdin; do not supply real tokens.

From the Tranquil checkout, with Docker, Node 24, and its pinned Rust toolchain:

```sh
export SPACES_PLAYGROUND_RUNNER=/absolute/path/to/opnshelf/backend/test/spaces-playground.cjs
export SPACES_PLAYGROUND_SCOPE='atproto space:xyz.opnshelf.settings?collection=xyz.opnshelf.privateSettings&manage=create'
env -u DATABASE_URL -u TRANQUIL_PDS_TEST_INFRA_READY -u S3_ENDPOINT \
  -u TRANQUIL_STORE_DATA_DIR ENABLE_ATPROTO_SPACES=true SQLX_OFFLINE=true \
  cargo test --locked -p tranquil-pds --test spaces manual::spaces_playground \
  -- --ignored --exact --nocapture
```

The runner first asserts create/read/update/delete using the real Opnshelf
`PrivateSettingsService` against the disposable PDS, then exposes a settings-only
fixture API on `127.0.0.1:3101`. Its application database and login/permission
transitions are synthetic. It does **not** verify the complete interactive OAuth
flow, DPoP or Prisma persistence; unit tests cover the grant replacement and
local cache boundaries, and the normal application trial above remains necessary
before rollout. Other pages intentionally return errors from this focused fixture.

From Opnshelf:

```sh
VITE_API_URL=http://127.0.0.1:3101 pnpm --filter web dev --host 127.0.0.1
EXPO_NO_DOTENV=1 REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 \
  EXPO_PUBLIC_API_URL=http://127.0.0.1:3101 \
  pnpm --filter mobile start --dev-client --port 8083 --lan
```

Web: <http://127.0.0.1:3000/settings/preferences>. The fixture supplies a signed-in
synthetic account. Mobile: open the development client against port 8083. If it
has no fixture session, the legacy local test link
`opnshelf://auth/complete?session=spaces-local-fixture` supplies a dummy session
accepted only by this runner; then open `opnshelf://settings/preferences`.
Never use that link against a real backend.

Stop the runner, Vite and Metro when finished. Identify the exact disposable
Postgres container created by this run (`tranquil_pds_test=true` label) and
remove only that container. Preserve any other running test playground.

## Automated OAuth and persistence trial

`backend/test/spaces-oauth.cjs` exercises the real `OAuthClientFactory`, device
session stores, permission controller, OAuth callback controller, settings service
and Prisma database against a disposable Tranquil PDS. It verifies:

- Core sign-in without Spaces, followed by explicit Spaces consent.
- Denied and partial grants preserving existing sessions.
- Successful connection replacing both existing device sessions atomically.
- DPoP-authenticated private writes, reads and token refresh.
- Disconnect obtaining a reduced grant, then reconnect recovering the private value.
- Private-copy deletion retaining the local preference and clearing its copy marker.

The runner maps only the fixture's advertised PDS/PLC/handle addresses to its
loopback servers. It seeds Core permission-set discovery from the checked-in
lexicon. Public AppView lookups return 404 and Tab registration is a no-op.
The real consent HTTP endpoints and callback controller are exercised directly;
this does not automate the PDS's browser UI, cookie transport or Mobile's OS
handoff. Those remain part of the normal application trial before rollout.

Create a fresh application database separate from the PDS fixture. For example:

```sh
docker run --detach --name opnshelf-spaces-oauth-db \
  --publish 127.0.0.1::5432 --env POSTGRES_HOST_AUTH_METHOD=trust \
  --env POSTGRES_DB=spaces_oauth postgres:18
docker port opnshelf-spaces-oauth-db 5432
```

From Opnshelf, substitute that loopback port. The runner rejects a non-loopback
host, a database not named `spaces_oauth`, or a database already containing users.

```sh
DOTENV_CONFIG_PATH=/dev/null \
  DATABASE_URL=postgresql://postgres@127.0.0.1:PORT/spaces_oauth \
  pnpm --filter backend exec prisma migrate deploy
```

Then from the Tranquil checkout (with the manual fixture's permission-set and
OAuth discovery overrides):

```sh
export OPNSHELF_WORKTREE=/absolute/path/to/opnshelf
export OPNSHELF_SPACES_DATABASE_URL=postgresql://postgres@127.0.0.1:PORT/spaces_oauth
export SPACES_PLAYGROUND_RUNNER="$OPNSHELF_WORKTREE/backend/test/spaces-oauth.cjs"
export SPACES_PLAYGROUND_PERMISSION_SET="$OPNSHELF_WORKTREE/lexicons/xyz/opnshelf/core.json"
env -u DATABASE_URL -u TRANQUIL_PDS_TEST_INFRA_READY -u S3_ENDPOINT \
  -u TRANQUIL_STORE_DATA_DIR SQLX_OFFLINE=true ENABLE_ATPROTO_SPACES=true \
  cargo test --locked -p tranquil-pds --test spaces manual::spaces_playground \
  -- --ignored --exact --nocapture
```

Two `PASS:` lines and a successful Rust test result indicate success. The runner
exits on completion. Remove `opnshelf-spaces-oauth-db` and the exact disposable
PDS container created by this run; keep containers used by any live UI fixture.
The runner keeps synthetic passwords and tokens in memory, never in output.
