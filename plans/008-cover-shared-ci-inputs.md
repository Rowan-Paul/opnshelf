# Plan 008: Validate shared monorepo inputs and expose one stable CI result

> **Executor instructions**: Follow every step and verification gate. Stop rather than improvising when a STOP condition applies. Update this plan's row in `plans/README.md` when complete unless the reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- .github/workflows/ci.yml pnpm-workspace.yaml turbo.json`
> Compare the excerpts below to live files if any path drifted; a mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/007-run-web-tests-in-ci.md`
- **Category**: dx
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The CI path filters treat package-local files, the root package manifest, and the lockfile as build inputs, but omit the workspace definition, Turbo task graph, and CI workflow itself. Those shared files can change how every workspace installs or verifies while causing no application job to run. Conditional job names also make branch protection awkward; a final always-present result gives maintainers one stable required check while preserving fast path filtering.

## Current state

- `.github/workflows/ci.yml:18-39` declares four filters. Each repeats `pnpm-lock.yaml` and `package.json`; none includes `pnpm-workspace.yaml`, `turbo.json`, or `.github/workflows/ci.yml`.

  ```yaml
  web:
    - 'apps/web/**'
    - 'packages/**'
    - 'pnpm-lock.yaml'
    - 'package.json'
  ```
- `.github/workflows/ci.yml:41-123` conditionally skips `web`, `backend`, `mobile`, and `api`; there is no aggregate job after them.
- `pnpm-workspace.yaml:1-5` defines `apps/*`, `packages/*`, and `backend`; changing it can alter every workspace install.
- `turbo.json:3-18` defines the root `build`, `check`, and `typecheck` task graph.
- Workflow convention: all application jobs declare `needs: changes` and use output equality checks such as `if: ${{ needs.changes.outputs.web == 'true' }}`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Inspect filters | `sed -n '18,45p' .github/workflows/ci.yml` | each filter visibly includes all shared inputs |
| Validate YAML parse | `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml", aliases: true)'` | exit 0 |
| Whitespace check | `git diff --check -- .github/workflows/ci.yml` | exit 0, no output |

## Scope

**In scope**:

- `.github/workflows/ci.yml`

**Out of scope**:

- `pnpm-workspace.yaml` and `turbo.json` — inputs to cover, not files to redesign.
- Adding new lint/test/build commands to application jobs.
- EAS workflow changes.
- Branch-protection configuration in GitHub; this plan only supplies a stable job to require.

## Git workflow

- Branch: `codex/improve-008-shared-ci-inputs`
- One focused commit with imperative subject `Cover shared inputs in CI`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add shared build inputs to every application filter

Within each of `web`, `backend`, `mobile`, and `api`, add these exact paths alongside the existing root inputs:

```yaml
- 'pnpm-workspace.yaml'
- 'turbo.json'
- '.github/workflows/ci.yml'
```

Retain all existing package-specific globs. Repetition is intentional because `dorny/paths-filter` has no shared-anchor convention in this workflow, and explicit filters are easier to audit.

**Verify**: `for p in pnpm-workspace.yaml turbo.json .github/workflows/ci.yml; do test "$(rg -F -- "- '$p'" .github/workflows/ci.yml | wc -l | tr -d ' ')" = 4 || exit 1; done` → exit 0.

### Step 2: Add a stable aggregate result job

Append a job with id `ci` and display name `CI result`. It must:

- use `needs: [changes, web, backend, mobile, api]`;
- use `if: ${{ always() }}` so the job exists when path-filtered jobs skip;
- run on `ubuntu-latest`;
- fail unless `changes` succeeded and each application result is either `success` or `skipped`.

Use a small shell step with each `${{ needs.<job>.result }}` passed through `env` (for example `CHANGES_RESULT`, `WEB_RESULT`) and a `case`/loop. Do not interpolate results into executable shell syntax. A skipped application is valid; `failure` or `cancelled` is not.

**Verify**: `rg -n -A30 '^  ci:$' .github/workflows/ci.yml` → shows `always()`, all five dependencies, and explicit validation of all five results.

### Step 3: Validate the workflow and inspect scope

**Verify**: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml", aliases: true)' && git diff --check -- .github/workflows/ci.yml` → exit 0 with no diff-check output.

## Test plan

- No application tests are added; this is workflow logic.
- Review the Actions result on its PR for three cases: a docs-only change (application jobs skipped, `CI result` passes), a web-only change (web runs, others skip, aggregate passes), and an intentionally failing workspace command on a temporary test branch (aggregate fails). Do not introduce the intentional failure into the implementation commit.
- Local structural verification is the filter-count command and YAML parse above.

## Done criteria

- [ ] All four path filters include `pnpm-workspace.yaml`, `turbo.json`, and `.github/workflows/ci.yml`.
- [ ] Existing package-specific filter paths remain present.
- [ ] A job named `CI result` runs under `always()` and accepts only success/skipped application results after a successful `changes` job.
- [ ] YAML parsing and `git diff --check` exit 0.
- [ ] No executor-created file outside `.github/workflows/ci.yml` and `plans/README.md` is modified.
- [ ] Index status is updated unless the reviewer owns it.

## STOP conditions

Stop if plan 007 has not landed, the workflow has switched away from `dorny/paths-filter`, GitHub branch protection requires a differently named check that the operator has not authorized changing, or the aggregate job would need repository-admin/API changes.

## Maintenance notes

Maintainers should require `CI result`, not one conditional workspace job. When adding a new workspace job, add its result to `needs` and to the accepted-result validation; otherwise its failure will not affect the stable gate.
