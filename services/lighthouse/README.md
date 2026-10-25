# Local Lighthouse dashboard

The standalone LHCI server is retained for local report inspection and history.
Lighthouse is no longer run in GitHub Actions or hosted on Railway. The local
collector remains available through `pnpm test:lighthouse`.

## Runtime

- Node 24; pinned `@lhci/server` and SQLite driver in the local npm lockfile.
- One replica with a dedicated persistent volume mounted at `/data`.
- SQLite database: `/data/lhci.db`. Do not connect the application Postgres or PDS.
- Required `LHCI_BASIC_AUTH_PASSWORD`: at least 32 characters. The server refuses
  to start without it. Optional `LHCI_BASIC_AUTH_USERNAME` defaults to `opnshelf`.
- `PORT` defaults to `9001`; `LHCI_HOST` defaults to
  `0.0.0.0`. `LHCI_STORAGE_PATH` can override the absolute database path.
- `/healthz` is public and reports only health. Dashboard, reports and APIs require
  Basic Auth.

The Dockerfile builds only this service. No browser runs in its container. The
Lighthouse override removes vulnerable downloader dependencies pulled
in by LHCI's old version range. The collector and dashboard both pin Lighthouse
13.5.0; update the root pnpm override and this service's npm override together.
Report validation checks each collected report against the dashboard pin.
Report upload/rendering must be smoke-tested when updating these overrides.
Historical reports retain their original version and may show a version warning;
compare scores against a baseline collected with the same Lighthouse version.
At preparation time `npm audit --omit=dev --audit-level=high`
passed; nine moderate transitive advisories remain in upstream CLI helpers and
UUID dependencies. Authentication is mandatory; do not expose this service without
it. Back up the independent volume before changing server/storage versions.

## Verification

From the repository root:

```sh
npm --prefix services/lighthouse ci
npm --prefix services/lighthouse test
node --check services/lighthouse/index.mjs
docker build --file services/lighthouse/Dockerfile --tag opnshelf-lighthouse:test .
```

Tests exercise fail-closed authentication, protected UI/API access and SQLite
history across restart. For a local server, set a test-only password and an
absolute temporary `LHCI_STORAGE_PATH`; never use a real dashboard credential in
a captured command.
