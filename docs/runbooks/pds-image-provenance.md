# PDS image provenance and migration compatibility

Before building a full Tranquil image, identify the exact deployed runtime
image digest and source commit. Production may run a Spaces branch beyond
`main`; a frontend-only change must not replace that runtime with an older one.
Read only deployment/image metadata, never deployed secret values.

The `tranquil-image` workflow pulls the currently published `latest` image and
pins its resolved registry digest in the candidate provenance. It hashes every
SQL migration from the candidate source and rejects removal or modification of
any migration in the baseline manifest before building or publishing. New
migrations are allowed; this check does not prove backup, rollback or operational
safety. Existing boot/S3 checks still run before tags are pushed.

New images carry `org.opencontainers.image.source`,
`org.opencontainers.image.revision`, `xyz.opnshelf.pds.migrations` (names and
SHA-256 hashes), and `xyz.opnshelf.pds.baseline` (immutable baseline digest).
The same check can be run before a manually approved publication:

```sh
docker pull rowanpaul/tranquil-pds:latest
node scripts/pds-image-provenance.mjs prepare /path/to/candidate rowanpaul/tranquil-pds:latest
```

For an older image without migration metadata the check deliberately fails.
Establish its exact runtime source from deployment/build records, check out that
full commit, and pass that clean source as the final argument. The workflow's
`baseline_source_url` and `baseline_source_ref` inputs offer the same one-time
bootstrap; the latter requires a full SHA. Do not guess a baseline from `main`.
If runtime and frontend came from different commits, use the runtime commit for
migration history and retain the separate frontend evidence in deployment notes.

`candidate-provenance.json` and `candidate-migrations.json` are local build
artifacts. Review them, then add the same labels to manually built images before
publication. Compare the baseline digest with Railway's active image metadata:
if `latest` and production differ, pass the deployed digest to the manual check
or workflow `baseline_image` input. No command
in this runbook deploys or changes a shared database.
