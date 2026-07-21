# Plan 017: Generate OpenAPI artifacts deterministically and reject client drift

> **Executor instructions**: Follow every step and gate. Stop on a listed condition rather than inventing infrastructure. Update `plans/README.md` unless the reviewer owns it.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- backend/src/main.ts backend/package.json backend/openapi.json backend/src/openapi.ts backend/src/generate-openapi.ts package.json packages/api/openapi-ts.config.ts packages/api/src/generated .github/workflows/ci.yml`
> Compare all live files with Current state after drift; mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/008-cover-shared-ci-inputs.md`
- **Category**: dx
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The generated shared API client is committed, but generation reads a live development server and CI only typechecks whatever was last committed. A backend DTO/controller change can therefore merge with a stale client, and backend paths currently do not trigger the API job. A checked-in deterministic OpenAPI document plus regenerate-and-diff gate makes backend contracts and client output reproducible and reviewable.

## Current state

- `backend/src/main.ts:64-75` constructs the Swagger document inline only outside production:

  ```ts
  const config = new DocumentBuilder()
    .setTitle("Opnshelf API")
    .setDescription("Personal media tracker powered by AT Protocol")
    .setVersion("1.0")
    .addCookieAuth("session")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);
  ```

- `packages/api/openapi-ts.config.ts:3-6` uses `input: 'http://127.0.0.1:3001/api-json'` and writes `src/generated`.
- Root `package.json:10` defines `generate:api` as only `pnpm --filter @opnshelf/api exec openapi-ts`.
- `.github/workflows/ci.yml:34-39` triggers `api` for `packages/api/**`, lockfile, and root package only; it neither watches `backend/**` nor regenerates artifacts.
- All 17 files under `packages/api/src/generated/` are tracked and start with the Hey API generated-file banner.
- Backend uses NodeNext TypeScript and already has `ts-node` in devDependencies. Do not add a runtime solely for this script.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Generate contract/client | `pnpm generate:api` | exit 0 without starting a listening HTTP server |
| Determinism | `pnpm generate:api && shasum backend/openapi.json packages/api/src/generated/*.ts packages/api/src/generated/**/*.ts` | repeated runs print identical hashes |
| Drift check | `git diff --exit-code -- backend/openapi.json packages/api/src/generated` | exit 0 after committed artifacts match source |
| Backend gate | `pnpm --filter backend run check && pnpm --filter backend exec tsc --noEmit && pnpm --filter backend run test` | exit 0 |
| API typecheck | `pnpm --filter @opnshelf/api exec tsc --noEmit` | exit 0 |

## Scope

**In scope**:

- `backend/src/main.ts`
- `backend/src/openapi.ts` (new)
- `backend/src/generate-openapi.ts` (new)
- `backend/openapi.json` (new generated artifact)
- `backend/package.json`
- `package.json`
- `packages/api/openapi-ts.config.ts`
- `packages/api/src/generated/**` (generator output only)
- `.github/workflows/ci.yml`
- `backend/src/openapi.spec.ts` (new, only if the extracted helper has meaningful pure behavior to assert; otherwise do not create it and rely on the two-run determinism gate)

**Out of scope**:

- Controller/DTO contract changes made solely to alter generated output.
- Database, Prisma schema, migrations, runtime API behavior, or Swagger production exposure.
- Installing Docker/Postgres or depending on a live backend in CI.
- Hand-editing any file under `packages/api/src/generated/`.

## Git workflow

- Branch: `codex/improve-017-openapi-drift-gate`
- Commit logical units: deterministic spec generation, generated-client input/artifacts, then CI drift gate.
- Use imperative subjects and do not push/open a PR unless instructed.

## Steps

### Step 1: Extract one Swagger document builder

Create `backend/src/openapi.ts` exporting a function that accepts the Nest application, constructs the existing `DocumentBuilder` metadata verbatim, and returns `SwaggerModule.createDocument`. Change `main.ts` to call this function before `SwaggerModule.setup`. Preserve the non-production guard and `/api` behavior.

**Verify**: backend check and typecheck commands exit 0; `rg -n 'new DocumentBuilder' backend/src` reports the builder only in `openapi.ts`.

### Step 2: Add an offline deterministic spec generator

Create `backend/src/generate-openapi.ts` which creates a Nest application from `AppModule` with logging disabled, calls the shared builder without listening on a port, serializes the document as stable pretty JSON with one trailing newline to `backend/openapi.json`, closes the application, and exits nonzero on error. The output path must resolve from the script location/repository layout rather than depend accidentally on the caller's current directory.

Add a backend package script using the already-installed `ts-node` in a NodeNext-compatible invocation. First prove that creating the document does not invoke module lifecycle services or require a reachable database/Tab. If Nest requires `app.init()` and that starts Prisma, ingester, OAuth, or workers, STOP: do not add service-specific disable flags ad hoc.

**Verify**: delete only a disposable copy or run the script over the tracked artifact twice; `pnpm --filter backend run openapi:generate` exits 0 twice without opening port 3001, and the second `git diff --exit-code -- backend/openapi.json` exits 0.

### Step 3: Make client generation consume the checked document

Change `packages/api/openapi-ts.config.ts` input to the repository's `backend/openapi.json` using the path interpretation verified for the package-scoped generator. Update root `generate:api` to run backend spec generation first and then Hey API generation. Generate and commit `backend/openapi.json` plus any mechanical changes under `packages/api/src/generated/**`; never edit generated output manually.

**Verify**: `pnpm generate:api && pnpm --filter @opnshelf/api exec tsc --noEmit` → exit 0; a second `pnpm generate:api` produces no diff in the JSON or generated directory.

### Step 4: Trigger and enforce drift checking in CI

After plan 008's shared paths are present, add `backend/**` to the `api` path filter (retain `packages/api/**` and root inputs). In the `api` job, run Prisma generation if required for importing `AppModule`, run `pnpm generate:api`, then run `git diff --exit-code -- backend/openapi.json packages/api/src/generated` before API typecheck. The diff command must fail the job on stale or nondeterministic generated artifacts.

**Verify**: `rg -n -A45 '^  api:$' .github/workflows/ci.yml` shows generation before diff before typecheck; YAML parses successfully.

### Step 5: Run full relevant gates

**Verify**: `pnpm generate:api && git diff --exit-code -- backend/openapi.json packages/api/src/generated && pnpm --filter @opnshelf/api exec tsc --noEmit && pnpm --filter backend run check && pnpm --filter backend exec tsc --noEmit && pnpm --filter backend run test` → every command exits 0 after generated artifacts are staged/committed or compared against an immediately generated baseline.

## Test plan

- Run generation twice and compare hashes/diff to prove determinism.
- Temporarily change an `@ApiOperation` summary without committing it, run generation, and confirm the drift command exits nonzero; revert only that deliberate local probe. Do not use destructive git commands when unrelated changes exist.
- Existing backend tests verify bootstrapped modules; API typecheck verifies generated exports compile.
- If `openapi.ts` contains pure metadata configuration that can be asserted without constructing the full app, add a focused `openapi.spec.ts`; do not mock the entire application merely to inflate coverage.

## Done criteria

- [ ] `pnpm generate:api` requires no listening backend and is deterministic over two runs.
- [ ] Runtime Swagger and offline generation use one shared builder.
- [ ] `backend/openapi.json` and generated client files are tracked and generator-owned.
- [ ] Backend changes trigger the API job.
- [ ] CI regenerates and fails on artifact drift before API typecheck.
- [ ] Backend check/typecheck/tests and API typecheck pass.
- [ ] No executor-created changes exist outside scope plus `plans/README.md`.
- [ ] Index status updated unless reviewer-owned.

## STOP conditions

Stop if offline document creation requires `app.init()` and consequently a live database, Tab, OAuth endpoint, background worker, or new test-only environment switches; if `ts-node` cannot run the script without a new dependency; if two clean generations differ; or if generated output changes for reasons unrelated to the checked document. Report the exact blocker and command output.

## Maintenance notes

Contract-changing backend PRs must commit both the OpenAPI JSON and generated client. Reviewers should reject hand edits under `packages/api/src/generated`. When adding a new workspace consuming the contract, reuse the checked JSON rather than reintroducing a live-server dependency.
