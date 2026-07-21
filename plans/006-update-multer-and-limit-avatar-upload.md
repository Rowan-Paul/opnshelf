# Plan 006: Patch Multer and constrain avatar multipart parsing

> **Executor instructions**: Follow this plan step by step, verify each step, and stop on any STOP condition. Update `plans/README.md` status when done unless told otherwise.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- package.json backend/package.json pnpm-lock.yaml backend/src/users/users.controller.ts backend/src/users/users.controller.spec.ts`
> If an in-scope file changed, compare the excerpts below; mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The resolved `multer@2.1.1` is affected by CVE-2026-5079 / GHSA-72gw-mp4g-v24j: deeply nested multipart field names can consume CPU and memory. The authenticated avatar endpoint is a reachable Multer parser and buffers uploads in memory before the service's 5 MB check. Resolve Multer 2.2.0+ and enforce parser-level file/field/depth limits.

## Current state

- `pnpm-lock.yaml:7378` resolves `multer@2.1.1` via `@nestjs/platform-express`.
- `backend/src/users/users.controller.ts:195-214` uses `@UseInterceptors(FileInterceptor("avatar"))` with no options.
- `backend/src/users/profile.service.ts:372-382` rejects files over 5 MB, but that happens after Multer has buffered the request.
- `backend/src/users/users.controller.spec.ts:4-6` currently mocks `FileInterceptor` and does not capture/assert its options.
- Vendor advisory: versions through 2.1.1 are affected; 2.2.0 patches the parser and adds `limits.fieldNestingDepth`. Do not copy exploit payloads into source or plans.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Update dependency | `pnpm --filter backend up @nestjs/platform-express@^11.0.1` (and, only if needed, add a root pnpm override for `multer@^2.2.0`) | lock resolves Multer >=2.2.0 |
| Audit | `pnpm audit --prod` | no GHSA-72gw-mp4g-v24j finding |
| Focused tests | `pnpm --filter backend test -- src/users/users.controller.spec.ts` | all pass |
| Gates | `pnpm --filter backend run check && pnpm --filter backend run typecheck && pnpm --filter backend run test` | all pass |

## Scope

**In scope**: `backend/package.json` if Nest dependency changes, root `package.json` only if a pnpm override is necessary, `pnpm-lock.yaml`, `backend/src/users/users.controller.ts`, `backend/src/users/users.controller.spec.ts`, and plan index status.

**Out of scope**: replacing Express/Multer, changing avatar image transformation or accepted MIME types, unauthenticated endpoints, reverse-proxy limits, addressing unrelated audit advisories, or writing/running a live resource-exhaustion exploit.

## Git workflow

- Branch: `codex/improve-006-patch-multer-avatar-limits`
- Commit: `fix(security): patch and constrain avatar multipart parsing`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Resolve a patched Multer version

Prefer upgrading `@nestjs/platform-express` within Nest 11 to a release whose dependency resolves Multer >=2.2.0. If the current compatible Nest package still permits/resolves 2.1.1, add the narrowest root `pnpm.overrides` entry for Multer `^2.2.0`; do not add Multer as an unused direct backend dependency. Run install only through pnpm so the lockfile remains authoritative. Confirm with `pnpm why multer` and `pnpm list multer -r`.

**Verify**: both dependency commands show no Multer below 2.2.0; `pnpm audit --prod` no longer reports GHSA-72gw-mp4g-v24j.

### Step 2: Reject oversized/complex multipart input before buffering

Pass options to `FileInterceptor("avatar", { limits: ... })`. Set `fileSize` to exactly the existing 5 MiB service limit, `files: 1`, `fields` to the minimum required by an avatar-only upload (zero if compatible, otherwise one), `parts` accordingly, and `fieldNestingDepth` to 1 because this endpoint needs no nested fields. Export/reuse the 5 MiB constant from a non-circular location if needed; do not create divergent magic numbers. Preserve the service's defense-in-depth size and MIME validation.

**Verify**: update the interceptor mock to capture arguments; focused tests assert field name and every limit.

### Step 3: Add safe multipart regressions

At minimum test decorator configuration without constructing a dangerous payload. If the existing Nest test harness can cheaply create an authenticated HTTP app, add Supertest cases proving a >5 MiB file and extra field are rejected before `uploadUserAvatar`; otherwise keep the deterministic interceptor-options unit test and document that integration coverage is deferred. Never create a payload designed to exhaust memory/stack.

**Verify**: focused tests pass and the upload service is not called for rejected input where integration coverage exists.

### Step 4: Run full backend gates

**Verify**: check, typecheck, full tests, and production audit all meet the expected results above.

## Test plan

- Capture `FileInterceptor` arguments at module evaluation and assert `avatar`, 5 MiB file size, one file, minimal fields/parts, and nesting depth 1.
- Preserve existing missing-file controller test.
- Optional safe integration: slightly over-limit buffer and one unexpected scalar field; no deeply nested/adversarial payload.
- Confirm downstream service still rejects oversize files as defense in depth through its existing profile tests.

## Done criteria

- [ ] Lockfile resolves only Multer >=2.2.0.
- [ ] Production audit does not report GHSA-72gw-mp4g-v24j.
- [ ] Avatar parser enforces file size/count, fields/parts, and nesting-depth limits before buffering.
- [ ] Existing service-level validation remains intact.
- [ ] Focused tests, check, typecheck, and full backend tests pass.
- [ ] Only in-scope files changed.

## STOP conditions

Stop if no Nest 11-compatible resolution supports Multer 2.2.0, an override produces duplicate/vulnerable Multer copies, `fieldNestingDepth` is absent from the installed Multer types/runtime, the endpoint legitimately requires nested fields, or audit cannot run because of network access (report the unverified gate rather than claiming success).

## Maintenance notes

Keep parser-level limits aligned with `MAX_AVATAR_BYTES`. Any future multipart endpoint needs its own minimal limits; a global permissive Multer configuration is not a substitute. Recheck the override after Nest upgrades and remove it once upstream resolves a patched version directly.
