# PDS Railway cutover runbook

This is the execution checklist for [ADR 0019](../adr/0019-isolate-pds-infrastructure-in-its-own-railway-project.md) and issue #188. It is intentionally source-controlled, but it is not an infrastructure-as-code deploy: create services, secret values, bucket credentials, custom domains, and automatic image updates in Railway's dashboard. Do not commit any generated credential or PDS secret.

## Target topology

Create project `opnshelf-pds` in EU West / Amsterdam. It contains only:

| Service | Source / image | Persistent state | Connectivity |
| --- | --- | --- | --- |
| `postgres` | Railway Postgres | dedicated PDS database | private to Tranquil |
| `tranquil-pds` | `rowanpaul/tranquil-pds:latest` | Railway Bucket, S3 backend | public `opnshelf.social` and `*.opnshelf.social` |
| `mail-relay` | `services/mail-relay/Dockerfile` | none | private SMTP from Tranquil |
| `pds-operator` | `rowanpaul/pds-operator:latest` | `/data` volume | public `operator.opnshelf.xyz` |

Keep Web, Server, Tap, and application Postgres in the existing `opnshelf` project. Set Railway image services to automatically update Docker images and configure an HTTP health check before enabling that setting: Tranquil `GET /xrpc/_health`; PDS Operator `GET /`.

The PDS database uses no scheduled backup or PITR. The Railway blob bucket has no versioning or secondary replica. These are accepted limitations, not omitted checklist items.

## Required configuration

Copy existing Tranquil cryptographic and operational secrets exactly. In particular, never regenerate the master/encryption key or signing/token secrets during a migration. Configure the dedicated Postgres URL and Tranquil's documented S3 backend variables with Railway bucket endpoint, bucket name, region, access key, and secret key; do not retain its legacy blob volume.

Configure `mail-relay` as documented in [its README](../../services/mail-relay/README.md), in this project so `mail-relay.railway.internal:2500` is private-reachable from Tranquil.

Configure PDS Operator with these non-secret values:

```text
PDS_HOSTNAME=opnshelf.social
PDS_ADMIN_IDENTIFIER=operator.opnshelf.social
RELAY_HOSTNAME=bsky.network
DB_PATH=/data/data.sqlite
AUDIT_LOG_PATH=/data/audit.log
DASHBOARD_URL=https://operator.opnshelf.xyz
NOTIFY_HANDLE=operator.opnshelf.social
NOTIFY_RECIPIENT=rowanpaulflynn.dev
```

Set `PDS_ADMIN_PASSWORD` to `operator.opnshelf.social`'s independently rotatable `pds-operator-admin` app password and `NOTIFY_APP_PASSWORD` to its DM-capable `pds-operator-alerts` app password. Generate and store a strong `SESSION_SECRET`. Leave `OPERATOR_PASSWORD_HASH` unset for passkey-only access. Copy `labelers.json.example` to the deployed service's `labelers.json` with Skywatch Blue's DID and this watchlist:

```json
[
  {
    "name": "skywatch blue",
    "did": "did:plc:e4elbtctnfqocyfcml6h2lf7",
    "labels": ["platform-manipulation", "engagement-abuse"]
  }
]
```

Promote `operator.opnshelf.social` with Tranquil's authenticated `/_admin.setAdminStatus` endpoint using an existing administrator; never modify the PDS database directly. Confirm it is permitted to send DMs to `rowanpaulflynn.dev` before go-live. Use Railway shell access and `node dist/cli.js enroll` to mint the initial passkey enrollment link.

## Pre-cutover rehearsal

1. Build the target services, verify health checks, and copy the legacy blob volume to the target bucket. Compare complete object counts and checksums.
2. Restore a copy of the legacy logical `pds` database into the target Postgres. Verify schema, account count, DID/handle sample, repository sample, and blob lookup sample.
3. Test PDS Operator passkey enrollment, restart it, and verify `/data/data.sqlite` and `/data/audit.log` persist. Test a Skywatch fixture and a DM to `rowanpaulflynn.dev`.
4. Test a controlled account: invite creation, signup, verification email through `mail-relay`, login, record create/read/delete, and Tap/Server ingestion.

## One-hour production window

At the announced start set these variables on the existing application Server and redeploy it:

```text
PDS_MAINTENANCE_MODE=true
PDS_MAINTENANCE_RETRY_AFTER_SECONDS=300
```

The backend then serves public reads but returns `503 Service Unavailable` with `Retry-After` for unsafe requests plus login/signup/callback paths. Confirm this before taking the final copy.

1. Take a consistent final dump of the legacy `pds` logical database and restore it into target Postgres.
2. Complete the final incremental blob copy and re-check count/checksum equality.
3. Start Tranquil on target Postgres plus the Railway bucket. Validate health, DID resolution, login/session behavior, relay crawl/sync, and representative repository/blob reads.
4. Transfer `opnshelf.social` and `*.opnshelf.social` to target Tranquil.
5. Start and validate PDS Operator at `operator.opnshelf.xyz`; enroll a passkey, search/list an account, and confirm an audit entry and test DM.
6. Re-run the controlled signup and ingestion smoke test. Only then set `PDS_MAINTENANCE_MODE=false` and redeploy Server.

If all validation is not complete within 45 minutes, leave maintenance mode active, restore the stable hostname to the old service, and roll Server back to its prior PDS configuration. Since writes remained blocked, no divergent data reconciliation is required.

## After cutover

Leave the legacy Tranquil service, its `pds` logical database, and blob volume stopped but intact for seven stable days. Do not delete them as part of this runbook; cleanup is tracked by issue #196.
