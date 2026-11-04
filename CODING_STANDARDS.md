# Coding standards

The reviewer applies these to a diff, whether that reviewer is an agent or a person. They are judgement
calls; mechanical rules live in the pre-commit and commit-msg hooks and in CI. The implementing agent's
rules are in [`AGENTS.md`](AGENTS.md).

Every finding names the rule it breaks, the file and line, and the fix.

## Product vocabulary

User-facing text, identifiers, commits and PR text use the canonical terms in
[`GLOSSARY.md`](GLOSSARY.md) and none of its avoid-list words. A diff that adds, renames or retires a
product concept also updates `GLOSSARY.md`.

## Web and Mobile parity

A user-facing change to one client is ported to the other in the same change, or the PR says why it
is not. Onboarding (ADR 0006) and URL shapes (ADR 0023) must match. When several issues are in
flight, the handoff reports parity as a table.

## Loading and pending states

- Skeletons match the shape they stand in for. Spinners are not used for content loading.
- Data already on screen stays visible while refetching, dimmed at most.
- A pending state is scoped to the item acted on, never the whole list.

## Visual changes

Layout, sizing and loading-state changes come with evidence from the target client: a browser for Web
(page and link), a simulator for Mobile (platform, route, screenshot). A visual fix judged only from
the diff is not done.

## Decisions and generated output

- Behaviour that contradicts an accepted ADR is a finding unless the PR supersedes that ADR.
- Generated output (see the table in `AGENTS.md`) changes only together with its source and the
  command that regenerates it.

## Scope and history

- One concern per PR. An unrelated "also" in the description is a finding.
- Commit bodies say why the old behaviour was wrong and what changed, and end with `Closes #<n>` when
  an issue exists.
