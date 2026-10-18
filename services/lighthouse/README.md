# Lighthouse CI dashboard

A standalone, protected LHCI server for Opnshelf report history, page reports and
build comparisons. It is outside the pnpm workspace, like the mail relay.
The server stores results; GitHub Actions runs the authenticated browser audits.

## Runtime

- Node 24; pinned `@lhci/server` and SQLite driver in the local npm lockfile.
- One replica with a dedicated persistent volume mounted at `/data`.
- SQLite database: `/data/lhci.db`. Do not connect the application Postgres or PDS.
- Required `LHCI_BASIC_AUTH_PASSWORD`: at least 32 characters. The server refuses
  to start without it. Optional `LHCI_BASIC_AUTH_USERNAME` defaults to `opnshelf`.
- `PORT` defaults to `9001`; Railway may supply it. `LHCI_HOST` defaults to
  `0.0.0.0`. `LHCI_STORAGE_PATH` can override the absolute database path.
- `/healthz` is public and reports only health. Dashboard, reports and APIs require
  Basic Auth. Use HTTPS at the public Railway endpoint.

Use a Railway service named `LHCI` in the existing application project `opnshelf`,
with a production-only volume and one replica. This dashboard serves CI results
from every branch; it does not need a second copy in staging. Set the service's
config-file path to `/services/lighthouse/railway.json`, keep the repository as
build context, and use the generated Railway HTTPS domain initially. Deployment
requires explicit operator approval under the root agent guide.

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

## Connect GitHub Actions

After deployment, create a project using the LHCI new-project wizard with:

- Project name: `Opnshelf authenticated CI`.
- Repository URL: `https://github.com/Rowan-Paul/opnshelf`.
- Base branch: `develop`.

Run the interactive setup yourself in Bash. This hides password entry and keeps
it out of shell history:

```bash
read -r -s -p 'Dashboard password: ' LHCI_SETUP_PASSWORD
printf '\n'
LHCI_BASIC_AUTH__USERNAME=opnshelf LHCI_BASIC_AUTH__PASSWORD="$LHCI_SETUP_PASSWORD" \
  pnpm exec lhci wizard --wizard=new-project
unset LHCI_SETUP_PASSWORD
```

Enter the protected HTTPS server origin when prompted. The wizard displays build
and admin tokens. Keep the admin token in your password
manager, never in CI or chat. The operator handles all real credentials; agents
must not read or reproduce them.

Configure repository Actions settings:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `LHCI_SERVER_URL` | Dashboard HTTPS origin, without embedded credentials |
| Variable | `LHCI_BASIC_AUTH_USERNAME` | Same username as the server, normally `opnshelf` |
| Secret | `LHCI_BASIC_AUTH_PASSWORD` | Same password as the server |
| Secret | `LHCI_BUILD_TOKEN` | Project's build token, never the admin token |

Uploads are enabled only when `LHCI_SERVER_URL` is configured. Missing credentials
then fail the upload step rather than silently losing history. Fork PRs get the
ordinary artifacts without upload credentials. Uploads use full Git history so
LHCI can identify an ancestor on `develop`. CI now also runs on pushes to
`develop` to establish baseline builds. Scores remain informational; audit
validity still blocks CI.

A rerun of an already stored commit is reported as a duplicate and does not
replace its original history. GitHub retains the current run's reports separately.
Do not send multiple environments under the same commit hash to one LHCI project:
LHCI identifies builds by project and hash. Deployed audits need an explicit build
identity and correct deployed commit metadata before adding them.

## Production and staging follow-up

Production/staging audits are not enabled by this service. They require dedicated
accounts with comparable populated data and real session setup. The fixture-only
session cannot authenticate to either environment.

Trigger deployed audits only after the exact deployment succeeds, record its
actual source commit and deployment URL, and audit both environments with the
same Chrome/settings. A shared staging site is not a preview of every PR. Keep
fixture PR-versus-develop comparisons distinct from live production-versus-staging
comparisons, because different content and API latency change measurements.

Choose the live project's environment/build identity and URL normalization
explicitly. Account handles and environment hosts must match for comparable
routes without collapsing distinct environment runs into one score. Do not simply
reuse the CI fixture project or label every staging deployment as the current PR.

## Verification

From the repository root:

```sh
npm --prefix services/lighthouse ci
npm --prefix services/lighthouse test
node --check services/lighthouse/index.mjs
docker build --file services/lighthouse/Dockerfile --tag opnshelf-lighthouse:test .
```

Tests exercise fail-closed authentication, protected UI/API access and SQLite
history across restart. The image is also built in CI when this service changes.
For a local server, set a test-only password and an absolute temporary
`LHCI_STORAGE_PATH`; never use a real dashboard credential in a captured command.
