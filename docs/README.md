# Documentation index

Working rules live in [`AGENTS.md`](../AGENTS.md); product vocabulary lives in
[`CONTEXT.md`](../CONTEXT.md). Setup, environment variables, test data,
external dependencies and how to test a change are in the
[root README](../README.md), with per-workspace notes in
[`backend/README.md`](../backend/README.md) and
[`apps/web/README.md`](../apps/web/README.md).

| Where | What |
| --- | --- |
| [`adr/`](adr/README.md) | Architectural decision records. The index lists every ADR with its number, title and status. |
| [`prd/`](prd/) | Product briefs: [community reviews with likes](prd/community-reviews-with-likes.md), [renaming the list-item lexicon](prd/rename-listitem-lexicon.md), [Review Bluesky Cross-post](prd/review-bluesky-cross-post.md). |
| [`runbooks/`](runbooks/) | Operational procedures. Currently the [PDS Railway cutover](runbooks/pds-railway-cutover.md) for ADR 0019. |
| [`cloudflare-email-migration-playbook.md`](cloudflare-email-migration-playbook.md) | Reusable playbook behind ADR 0007 for moving a project's email to Cloudflare Email Sending. |
| [`../plans/`](../plans/README.md) | Numbered implementation plans with a status table. Read a plan in full before executing it and update its status row when done. |

Documentation changes ship in the same branch as the code they describe. A new
architectural or business decision gets an ADR; a new product term gets a
`CONTEXT.md` entry.
