# Private Settings local trial

Private Settings currently stores `timeFormat`. The feature is disabled by
default; ADR 0045 defines its ownership and failure behavior. This local stack
runs the normal Opnshelf backend and clients, Tranquil server and consent UI,
PLC directory, Tab, Postgres and Mailpit. There are no simulated logins,
permission changes, PDS responses or application database adapters.

## Start the stack

This runner targets macOS with OrbStack. Use Node 24, the repository's pnpm
version, OpenSSL, and the Rust toolchain pinned by the Tranquil checkout. Docker host networking is needed
for Tab to resolve the loopback PDS advertised in local DID documents. This has
been verified with OrbStack on macOS. The nip.io wildcard resolves account handles
to 127.0.0.1; a Docker TCP gateway binds loopback port 443 and forwards TLS to
the PDS on port 3443. DNS must allow these loopback answers. OAuth uses a real
HTTPS hostname, and handle verification uses the standard HTTPS port. The local
backend sets `HANDLE_RESOLVER_URL` to the real PDS’s XRPC resolver and
`PLC_DIRECTORY_URL` to the local PLC; OAuth still verifies the bidirectional
handle/DID binding. Hosted configuration is unchanged.

From the Opnshelf checkout:

```sh
export TRANQUIL_SOURCE=/absolute/path/to/tranquil-pds
# Optional: reuse an existing Rust build directory.
export CARGO_TARGET_DIR="$TRANQUIL_SOURCE/target"
pnpm dev:spaces:setup
pnpm dev:spaces
```

Setup builds both backends and the PDS frontend, applies migrations only to the
isolated local application database, and creates a 30-day local PDS certificate.
On macOS it trusts that certificate in the current user's login keychain; an OS
authorization prompt may appear. On other systems, trust the certificate in the
system/browser store before starting. Node trusts only the added certificate
through `NODE_EXTRA_CA_CERTS`; TLS verification remains enabled.

Runtime configuration, certificate material, blobs and logs live under
`~/.local/share/opnshelf-spaces` (override `OPNSHELF_SPACES_STATE_DIR`). Postgres
and Tab use dedicated Docker volumes. Data persists across restarts. Neither
backend loads a checkout's `.env`; the runner passes an explicit local environment.
The stack does not notify public relays. Public lexicon discovery still performs
read-only network requests for the published Core permission set. The runner
uses `1.1.1.1:53` for PDS lexicon TXT lookups, avoiding VPN DNS stubs that reject
them; override `OPNSHELF_SPACES_DNS_SERVER` to use your preferred DNS server.
System DNS settings are not changed.

| Service | Address |
| --- | --- |
| Web | <http://127.0.0.1:3000/signup> |
| Backend | <http://127.0.0.1:3102/api> |
| PDS and consent UI | <https://pds.127.0.0.1.nip.io> |
| Captured email | <http://127.0.0.1:8025> |
| PLC directory | `http://127.0.0.1:2582` |
| Tab | `http://127.0.0.1:2481` |
| Metro | `http://127.0.0.1:8083` |
| Local Postgres | `127.0.0.1:55432` |

A local-only operator account is provisioned to mint the same signup invitations
used by the normal app. It is not an application session. Create your own user
through the Web signup form; the handle domain is `pds.127.0.0.1.nip.io`. Copy
the verification code from Mailpit, then complete the real PDS login and Core consent redirect.
Do not use personal passwords or real email addresses in this development stack.
Google/Apple sign-in, push/email delivery and TMDB catalogue lookups require their
separate integrations and are intentionally unconfigured. Private Settings and
password signup do not require them. Skip streaming-service selection and the
watched-title step when catalogue requests are unavailable. Dismiss the first-run
tour before opening Settings.

## Browser verification

1. Sign up, verify the captured email, and complete PDS login and Core consent.
   Finish onboarding, then open Settings → Preferences.
2. Connect Private Settings. Confirm the warning about other devices, inspect the
   added Space permission on the PDS, and approve. The callback must return to
   the local app with its session cookie.
3. Save the current time format, change it and reload. The setting must persist.
4. Disconnect. Complete the reduced-scope authorization. The private record stays
   on the PDS; ordinary local settings remain usable.
5. Connect again and confirm the saved private value is recovered. Tranquil may
   reuse remembered consent, so a new consent screen is not guaranteed each time.
6. Delete the private copy. The local value stays, and reload must not recreate
   the private record. Explicitly save it to recreate it.
7. On a fresh grant, deny or partially grant optional access. Existing sessions
   must survive; a partial grant must not replace a working session.

For Mobile, use the development client with Metro on port 8083. Sign in normally;
there is no dummy-session link. On an iOS simulator, trust the local certificate
in the simulator before testing the system-browser OAuth handoff. Android's
loopback addresses need emulator port forwarding or a matching device-local
configuration. No native configuration or version change is needed for Spaces.

## Stop and restart

Ctrl-C stops the application processes owned by the runner. Then:

```sh
pnpm dev:spaces:stop
```

This stops only the named local stack and keeps its data. Running `pnpm dev:spaces`
starts it again. Restart after rebuilding changed backend code; Web and Metro
retain their usual hot reload. Rerun setup after changing the PDS frontend or
backend, application migrations, or after the local certificate expires (remove
the expired certificate and key first). Never use Staging for this trial: it
shares the production PDS.

## Verification recorded on 2026-10-06

The real browser flow exercised account creation, captured-email verification,
PDS password login, published Core consent, onboarding, and Private Settings
consent. Saving a copy, changing `timeFormat`, and reloading recovered the remote
value. After disconnecting, changing the local value, and reconnecting, the
remote value was recovered again. Deleting the private copy retained the local
value; reload and a complete application-process restart did not recreate it.
The last browser state is connected with no private copy, ready to save again.

Checks run from Opnshelf:

- `pnpm typecheck` and `pnpm check`: passed.
- `pnpm --filter backend run test`: 1,160 passed; two existing skips.
- `pnpm --filter backend run build`: passed.
- `pnpm --filter web run test`: 415 passed; one existing skip.
- `pnpm --filter mobile run test`: 363 passed; one existing skip.
- `node --check scripts/local-spaces.mjs` and Compose configuration validation:
  passed. Setup and repeated starts completed; the backend binds loopback only.

Checks run from the Spaces-enabled Tranquil checkout:

- `cargo build -p tranquil-server --features native-tls-roots`: passed; Cargo
  updated the lockfile for the resolver dependencies.
- `cargo test --locked -p tranquil-config -p tranquil-scopes -p tranquil-lexicon
  --features tranquil-lexicon/resolve -- --test-threads=1`: 214 passed. The first
  parallel run hit an existing config-test race over `SENDMAIL_PATH`; serial
  execution passed.
- `cargo clippy --locked -p tranquil-config -p tranquil-scopes -p tranquil-lexicon
  --features tranquil-lexicon/resolve --all-targets -- -D warnings`: passed.
- `cargo fmt --all -- --check`: passed.
- `pnpm --dir frontend test:run`: 238 passed.
- `pnpm --dir frontend check`: no errors or warnings.
- `pnpm --dir frontend build`: passed with the local signup URL.

The native simulator OAuth handoff and fresh declined/partial grants were not
manually repeated in this run. Existing automated scope and session tests remain
in place. No Mobile version was changed and no OTA/store release was made.

The typed Web login form was also regression-tested and browser-verified. It
now sends the handle directly into backend OAuth resolution, matching Mobile,
instead of rejecting local accounts through a Bluesky public-API pre-check.
