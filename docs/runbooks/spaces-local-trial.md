# Privacy Alpha local trial

This stack runs the normal Opnshelf clients and backend, a Spaces-enabled
Tranquil PDS/consent UI, local PLC, Tab, Postgres and Mailpit. ADR 0048 retired
the Private Settings experiment. Privacy now covers Shelf, Library, Notes and
Lists; ordinary time-format preferences remain application settings.

Read [session ownership](development-sessions.md) before starting or stopping it.

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
separate integrations and are intentionally unconfigured. Privacy and password signup do not require them. Skip streaming-service selection and the
watched-title step when catalogue requests are unavailable. Dismiss the first-run
tour before opening Settings.

## Browser and Mobile verification

1. Sign up, verify the Mailpit email, complete real PDS consent, and finish
   onboarding. Public is initially selected for every Privacy category.
2. Open Settings → Privacy. Switch Notes to Private and approve added access.
   The callback returns to this screen and the category migration completes.
3. Create a synthetic Note, reload, and confirm it remains available to its owner.
4. Switch Notes to Public, confirm publication and verify completion. A denied
   or cancelled authorization must preserve the existing session and visibility.
5. Create a synthetic List, switch All Lists to Private, and observe progress
   with counts. Individual List changes and retries remain usable. Public
   confirmation is required when switching back.
6. Repeat Shelf and Library Public → Private → Public with synthetic records.
   Use [UI scenarios](development-sessions.md) for deterministic failures,
   delayed callbacks, short screens and large text.

For Mobile, connect the development client to Metro on port 8083 and sign in
normally. Trust the local certificate in the iOS simulator before the system
browser handoff. Android requires loopback forwarding and matching certificate
trust. Check the original platform when addressing a native-specific failure.
For reference-PDS interoperability use [reference verification](privacy-reference-smoke.md);
Tranquil UI checks alone do not prove reference consent compatibility.

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

## Historical verification

The 2026-10-06 run verified real signup, email verification and the now-retired
Private Settings experiment. It is not evidence for current Privacy Alpha.
Current category and reference OAuth evidence is recorded in
[Privacy reference verification](privacy-reference-smoke.md).
