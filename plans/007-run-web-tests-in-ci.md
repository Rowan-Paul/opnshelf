# Plan 007: Run the existing web tests on every relevant CI change

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` unless the reviewer maintaining the index tells you not to.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- .github/workflows/ci.yml apps/web/package.json`
> If an in-scope file changed since this plan was written, compare the "Current state" excerpts against the live file before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The web workspace already has a fast Vitest suite covering ratings, review rendering, date handling, and Trakt UI behavior, but CI only runs Biome and TypeScript. A regression can therefore merge even when a committed test catches it locally. This plan makes the existing suite a merge gate without changing test behavior or broadening application scope.

## Current state

- **Verified baseline exception (2026-07-20):** the clean planned commit fails
  Biome 2.4.5 only on pre-existing formatting in
  `apps/web/src/routes/profile.$handle/shelf.tsx` (the `Math.round` /
  `Intl.DateTimeFormat`, `ShelfWatchCard`, and `episodeInfo` expressions). This
  is unrelated to the workflow-only change and is already corrected in the
  user's uncommitted working tree. The executor may proceed if and only if the
  failure remains limited to that file and those expressions; do not edit or
  commit the shelf route on this branch.

- `.github/workflows/ci.yml:42-66` defines the path-filtered `web` job. Its last two commands are currently:

  ```yaml
  - name: Lint
    run: pnpm --filter "./apps/web" run check

  - name: Typecheck
    run: pnpm --filter "./apps/web" exec tsc --noEmit
  ```

- `apps/web/package.json:6-16` already exposes the correct non-watch test command:

  ```json
  "scripts": {
    "test": "vitest run",
    "check": "biome check",
    "typecheck": "tsc --noEmit"
  }
  ```

- Existing tests live beside production code under `apps/web/src/**/*.test.ts(x)`; examples include `apps/web/src/components/CommunityReviews.test.tsx` and `apps/web/src/lib/date-utils.test.ts`.
- CI commands are run from the repository root and select a workspace with `pnpm --filter`; match that convention exactly.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Web tests | `pnpm --filter "./apps/web" run test` | exit 0; all existing Vitest files pass |
| Web check | `pnpm --filter "./apps/web" run check` | exit 0 |
| Web typecheck | `pnpm --filter "./apps/web" exec tsc --noEmit` | exit 0, no errors |
| Inspect workflow diff | `git diff --check -- .github/workflows/ci.yml` | exit 0, no output |

## Scope

**In scope** (the only source/configuration file to modify):

- `.github/workflows/ci.yml`

**Out of scope**:

- `apps/web/package.json` — the required `test` script already exists.
- Any web source or test file; do not weaken, skip, or rewrite tests to make CI pass.
- CI path filters and the other jobs; plan 008 owns those changes.
- Dependency or lockfile changes.

## Git workflow

- Branch: `codex/improve-007-web-tests-ci`
- Use one focused commit. Recent history uses short imperative subjects, for example `Show follow suggestions when search is focused`; use `Run web tests in CI`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Establish the local web verification baseline

Run the existing check, typecheck, and tests before editing. Do not change tests in response to a failure.

**Verify**: run all three commands. Typecheck and tests must exit 0. The check
may fail only with the exact verified baseline exception documented above; any
additional diagnostic is a STOP condition.

### Step 2: Add the web test gate

In `.github/workflows/ci.yml`, append a named `Test` step to the `web` job after `Typecheck`:

```yaml
- name: Test
  run: pnpm --filter "./apps/web" run test
```

Keep it in the existing job so it inherits checkout, Node 24, pnpm setup, frozen-lockfile install, and the current web path filter.

**Verify**: `rg -n -A2 '^      - name: Test$' .github/workflows/ci.yml` → includes exactly one web `Test` step whose command is `pnpm --filter "./apps/web" run test` (the backend's pre-existing `Test` step will also match the name).

### Step 3: Re-run the exact local gate

**Verify**: `pnpm --filter "./apps/web" run test && git diff --check -- .github/workflows/ci.yml` → tests pass and the diff check emits no output.

## Test plan

- Do not add new tests; this plan wires the committed suite into CI.
- The regression check is structural: the web job invokes the same `vitest run` script developers use locally.
- Verification: `pnpm --filter "./apps/web" run test` → all test files pass with no watch process left running.

## Done criteria

- [ ] The web CI job contains `run: pnpm --filter "./apps/web" run test` after its typecheck step.
- [ ] `pnpm --filter "./apps/web" run test` exits 0.
- [ ] Web typecheck exits 0; check either exits 0 or reports only the exact
  verified baseline exception above.
- [ ] `git diff --check -- .github/workflows/ci.yml` emits no output.
- [ ] `git diff --name-only` shows no executor-created change outside `.github/workflows/ci.yml` and `plans/README.md`.
- [ ] The plan's `plans/README.md` status row is updated unless the reviewer owns the index.

## STOP conditions

Stop and report if the web test script is no longer `vitest run`, the web job has been removed or substantially reorganized, baseline tests or typecheck fail before the workflow edit, Biome reports anything beyond the exact verified baseline exception above, or satisfying the gate appears to require changing a test/application file.

## Maintenance notes

Keep this command aligned with `apps/web/package.json`; the workflow should call the package script rather than duplicating Vitest flags. Plan 008 subsequently expands workflow path coverage and adds a stable aggregate result, so execute it after this plan.
