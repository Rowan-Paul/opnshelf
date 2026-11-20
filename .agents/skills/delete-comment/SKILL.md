---
name: delete-comment
description: Audit and remove code comments in a requested Opnshelf scope. Use when asked to clean up stale or redundant comments or reduce the comment baseline.
---

Default to handwritten `packages/api/src`. Run `pnpm check:api-comments --list`
to inventory comments and estimate removable lines there. For other scopes,
inspect the requested source directly. Exclude generated files.

Read each comment with its surrounding code and applicable ADRs.

- Delete comments that repeat the code or describe retired behavior.
- For a workaround, verify the failure it addresses. Check for existing
  issues and draft a follow-up when needed. Keep the behavior and preserve
  its rationale in the follow-up before removing the comment. Publish an
  issue only with explicit authorization and follow the issue tracker guide.
- Move durable, non-obvious decisions into the relevant ADR. Keep local
  contracts and tooling directives when deleting them would lose information
  or change behavior.
- For comments that need further investigation, leave the baseline entry
  in place and report the reason.

Run `pnpm check:api-comments --prune` after deleting comments in the shared
API source. Run the affected gates from AGENTS.md. Report the lines removed,
the remaining estimate, ADR updates, and issue drafts.
