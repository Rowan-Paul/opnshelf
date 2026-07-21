# Plan 001: Scope every AT Protocol record key by repository owner

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- backend/prisma/schema.prisma backend/prisma/migrations backend/src/ingester backend/src/movies backend/src/shows backend/src/lists backend/src/library backend/src/notes backend/src/reviews backend/src/ratings backend/src/generated`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: security, bug, migration
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

An AT Protocol `rkey` is unique only inside one repository and collection. Opnshelf currently makes it globally unique in most cached AT-backed tables and uses it alone for upserts and deletes. Two users can legitimately publish the same key (deterministic watch imports make this easy), allowing one user's event to overwrite or delete another user's cached row. The migration and every index/delete caller must change atomically so repository ownership is part of record identity.

## Current state

- `backend/prisma/schema.prisma` — `TrackedMovie`, `TrackedEpisode`, `List`, `ListItem`, `LibraryItem`, `Note`, `Review`, `Publication`, `Rating`, and `ReviewLike` declare `rkey String @unique`; all except `ListItem` already store `userDid`. `ListItem` reaches its owner only through `list.userDid`.
- `backend/src/ingester/ingester.service.ts` — has the event repository as `evt.did`, but watch upserts/deletes use only the key:

```ts
// backend/src/ingester/ingester.service.ts:592-615
await this.prisma.trackedMovie.upsert({
  where: { rkey: evt.rkey },
  create: { rkey: evt.rkey, userDid: evt.did, /* ... */ },
  update: { /* ... */ },
});
// delete path
where: { rkey: evt.rkey }
```

- Service indexers repeat `upsert({ where: { rkey } })`, while delete methods accept only `rkey`: `lists.service.ts:960-1092`, `library.service.ts:238-271`, `notes.service.ts:236-263`, `reviews.service.ts:1508-1612`, and `ratings.service.ts:223-250`.
- Immediate API writers use the same global identity in `movies.service.ts:396-417` and `shows.service.ts:1013-1035`.
- `Follow` is already correctly scoped (`@@id([followerDid, followingDid])`, `@@index([followerDid, rkey])`) and `deleteFollowRecordIndex(followerDid, rkey)` includes its owner. `User.profileRkey` is stored on the owner row. Do not redesign either.
- Existing migrations use explicit, commented PostgreSQL in `backend/prisma/migrations/<timestamp>_<slug>/migration.sql`; model new migration commentary and safety checks after `20260707120000_cleanup_composite_show_ids/migration.sql`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Generate client | `pnpm --filter backend exec prisma generate` | exit 0; `backend/src/generated` reflects composite selectors |
| Format/check | `pnpm --filter backend run check` | exit 0, no diagnostics |
| Typecheck | `pnpm --filter backend run typecheck` | exit 0, no errors |
| Focused tests | `pnpm --filter backend test -- src/ingester/ingester.service.spec.ts src/movies/movies.service.spec.ts src/shows/shows.service.spec.ts src/lists/lists.service.spec.ts src/library/library.service.spec.ts src/notes/notes.service.spec.ts src/reviews/reviews.service.spec.ts src/ratings/ratings.service.spec.ts` | all pass |
| Full tests | `pnpm --filter backend run test` | all pass |

## Scope

**In scope** (the only files you should modify):
- `backend/prisma/schema.prisma`
- one new `backend/prisma/migrations/<timestamp>_scope_at_record_keys_by_owner/migration.sql`
- generated Prisma files under `backend/src/generated/`
- `backend/src/ingester/ingester.service.ts` and `.spec.ts`
- `backend/src/movies/movies.service.ts` and `.spec.ts`
- `backend/src/shows/shows.service.ts` and `.spec.ts`
- `backend/src/lists/lists.service.ts` and `.spec.ts`
- `backend/src/library/library.service.ts` and `.spec.ts`
- `backend/src/notes/notes.service.ts` and `.spec.ts`
- `backend/src/reviews/reviews.service.ts` and `.spec.ts`
- `backend/src/ratings/ratings.service.ts` and `.spec.ts`
- `plans/README.md` status only

**Out of scope** (do NOT touch):
- AT records in users' PDSes, lexicons, public API response shapes, or rkey generation.
- `Follow` and profile identity; they are already owner-scoped.
- Recovering records previously lost to a cross-owner overwrite. The cache can only recover those through a separately authorized full repo replay/backfill.
- Unrelated unique constraints such as one rating per user/media or one library format per user/media.

## Git workflow

- Branch: `codex/improve-001-owner-scoped-rkeys`
- Use focused commits such as `fix(backend): scope AT record keys by owner`; keep migration/schema/generated output with the caller changes that require it.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add collision-characterization tests before changing production code

In each affected service suite, prove that the same `rkey` from two DIDs generates distinct owner-qualified Prisma selectors, and that deleting DID B cannot target DID A. Cover both direct watch paths and ingester-routed service calls. For `ListItem`, assert `userDid` is passed to its indexer and delete method; its cached row needs an explicit `userDid` scalar because collection record identity is `(repo DID, collection, rkey)`, not `(listId, rkey)`. Include at least one regression with a deterministic watch key shared by two DIDs. Update mocks to expose composite selectors but do not weaken existing assertions.

**Verify**: run the focused test command before production changes → new assertions fail specifically because selectors/signatures are still rkey-only.

### Step 2: Change the schema and write a data-preserving migration

For each affected model, replace global `@unique` on `rkey` with a named composite `@@unique([userDid, rkey])` and retain useful `rkey` indexes only if query evidence requires them. Add non-null `userDid` to `ListItem` and an index for it; do not add a second Prisma relation if it creates ambiguous `User` relations. In SQL, add `ListItem.userDid` as nullable, backfill it from its parent `List.userDid`, assert no NULL remains (a guarded `DO` block is acceptable), then make it NOT NULL. Drop old global unique constraints and add composite unique constraints for all ten tables. Do not delete or merge rows. Make constraint names explicit and match Prisma's generated expectation.

Before applying locally, use `pnpm --filter backend exec prisma migrate diff --from-migrations backend/prisma/migrations --to-schema backend/prisma/schema.prisma --script` to compare intended DDL. If this requires a shadow database unavailable locally, inspect SQL manually and rely on CI/deployment migration verification; do not point Prisma at a production database.

**Verify**: `pnpm --filter backend exec prisma validate && pnpm --filter backend exec prisma generate` → exit 0; generated types expose selectors such as `userDid_rkey` for all affected models.

### Step 3: Make every write and delete owner-qualified

Replace every rkey-only `where` for the affected models with the generated `(userDid, rkey)` compound selector. Add `userDid` to `ListItem.create`. Change all index/delete method signatures that lack an owner to accept `userDid`, and update every ingester caller to pass `evt.did`, including delete events. Preserve URI/CID and business-field update behavior. Audit with `rg` rather than relying on the initial file list:

`rg -n 'where:\s*\{\s*rkey|deleteMany\(\{\s*where:\s*\{\s*rkey' backend/src --glob '*.ts' --glob '!generated/**'`

Every remaining match must either be unrelated to an AT-backed model or be owner-qualified on surrounding lines. Never put `userDid` in an update payload, which could transfer row ownership.

**Verify**: `pnpm --filter backend run typecheck` → exit 0; `rg` audit finds no ownerless AT-backed lookup/upsert/delete.

### Step 4: Pass collision and deletion-isolation regressions

Update existing expected calls, then ensure tests cover all ten owner-scoped models, including two same-rkey owners and owner-qualified delete behavior. The ingester suite must assert `evt.did` is forwarded to each service deletion and used directly for movie/episode selectors.

**Verify**: focused tests → all pass; then `pnpm --filter backend run check && pnpm --filter backend run test` → both exit 0.

## Test plan

- Model tests after the existing service specs; use their current mocked Prisma pattern.
- Required cases: same rkey/two owners do not share a selector; update preserves owner; wrong-owner delete targets zero rows; list-item owner is backfilled/persisted; ingester forwards DID for every create/update/delete collection.
- Migration verification against a disposable PostgreSQL database, if available: seed one row per table, migrate, confirm row counts unchanged, confirm duplicate `rkey` with a second owner succeeds, and duplicate `(userDid,rkey)` fails.
- Verification: focused command and full backend test command above both pass.

## Done criteria

- [ ] All ten cached AT-backed models have owner-qualified unique record identity; no global `rkey @unique` remains on them.
- [ ] Migration backfills `ListItem.userDid`, preserves all rows, and adds composite constraints without touching PDS data.
- [ ] `rg` confirms no rkey-only upsert/delete remains for affected models.
- [ ] Prisma generation, backend check, typecheck, focused tests, and full tests exit 0.
- [ ] Collision and wrong-owner-delete regressions exist and pass.
- [ ] `git status --short` shows only in-scope files plus the plan index status.

## STOP conditions

Stop and report back if any current-state excerpt has drifted; the database contains a `ListItem` whose parent list is missing or whose owner cannot be derived; Prisma cannot express a required compound selector without changing a public contract; a migration would delete/merge rows; an affected AT-backed model lacks a trustworthy repository-owner field; or implementation requires a production database/repo replay.

## Maintenance notes

Future AT-backed collections must model identity as repository DID + collection-local rkey. Reviewers should scrutinize migration constraint names, every delete path, and update payloads for accidental ownership changes. A separately planned backfill may be useful because a previously overwritten cache row cannot be reconstructed from this migration alone.
