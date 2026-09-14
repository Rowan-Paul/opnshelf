# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo: one glossary and one ADR directory at the root, even though the pnpm workspace holds several packages.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root. It controls exact product vocabulary and carries an avoid list per term.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. [`docs/adr/README.md`](../adr/README.md) is the index with number, title, and status; check for superseding ADRs before relying on one.
- **`plans/`**: when the task names a numbered plan, read it in full and honor its STOP conditions.

Use `docs/README.md` as the index; load only what the task needs rather than every document.

## File structure

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/            ← architectural decisions, indexed in README.md
│   ├── prd/            ← product briefs
│   └── runbooks/       ← operational procedures
└── plans/              ← numbered implementation plans with a status table
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap. A change that adds, renames, or retires a product concept updates `CONTEXT.md` in the same change.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0010 (circles are local-only), but worth reopening because…_

`AGENTS.md` goes further: if implementation and an accepted ADR conflict, stop and surface the conflict instead of changing the decision. A new non-trivial architecture or business decision gets its own ADR in `docs/adr/`.
