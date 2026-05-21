# PRD: Rename `xyz.opnshelf.listItem` Lexicon to `xyz.opnshelf.list.item`

## Problem Statement

The `listItem` ATProto lexicon uses a flat 3-part NSID (`xyz.opnshelf.listItem`) instead of the standard ATProto 4-part hierarchical convention (`xyz.opnshelf.list.item`). This is inconsistent with how the platform intends to structure domain-specific record types and makes the lexicon hierarchy harder to reason about. All other lexicons in the system (`review`, `follow`, `note`, etc.) are top-level concepts, but `listItem` is clearly a subordinate record type under the `list` domain.

## Solution

Rename the ATProto lexicon from `xyz.opnshelf.listItem` to `xyz.opnshelf.list.item`. Update all backend code that references the old collection name — imports, constants, PDS writes, firehose ingestion, tests, and the OAuth scope string. Regenerate the TypeScript lexicon code from the updated JSON source. Leave the Prisma `ListItem` model name unchanged; only the ATProto collection identifier changes.

## User Stories

1. As a developer reading the codebase, I want the ATProto lexicon names to follow standard convention, so that I can understand the domain hierarchy at a glance.
2. As a developer adding new subordinate record types, I want a precedent for nested NSIDs, so that I know where to place them.
3. As a future operator of a federated opnshelf instance, I want consistent lexicon naming, so that interop is predictable.

## Implementation Decisions

### 1. Lexicon JSON Source File Rename

The source lexicon JSON files live in `lexicons/app/opnshelf/`:

- Rename `listItem.json` → `list/item.json` (new nested directory)
- Update the `id` field inside the JSON from `"xyz.opnshelf.listItem"` → `"xyz.opnshelf.list.item"`
- The `$type` inside the record schema also changes to `"xyz.opnshelf.list.item"`

All other lexicon JSON files remain untouched.

### 2. Lexicon TypeScript Regeneration

Run `pnpm run lex:build` in the backend package. This command:
- Reads from `../lexicons` (which is `lexicons/app/opnshelf/`)
- Outputs generated TypeScript to `./src/lexicons`
- Clears the output directory first (`--clear`)

After regeneration:
- `backend/src/lexicons/xyz/opnshelf/listItem.ts` and `listItem.defs.ts` will be **deleted**
- New files will appear: `backend/src/lexicons/xyz/opnshelf/list/item.ts` and `list/item.defs.ts`
- `backend/src/lexicons/xyz/opnshelf.ts` will be regenerated with the updated export map

**Do not hand-edit generated files.** All changes must flow from the JSON source through the generator.

### 3. IngesterService — Update Collection Reference

The ingester routes firehose events by collection name. Change `LIST_ITEM_COLLECTION` from `"xyz.opnshelf.listItem"` to `"xyz.opnshelf.list.item"`.

Files to update:
- Import path: `../lexicons/xyz/opnshelf/listItem` → `../lexicons/xyz/opnshelf/list/item`
- Import names: `$nsid as LIST_ITEM_COLLECTION`, `main as listItemSchema`, `Main as ListItemRecord`
- The `handleRecordEvent` dispatch branch remains structurally identical; only the constant value changes
- The `handleListItemEvent` method body is unchanged (it works with the parsed record, not the collection name)

### 4. ListsService — Update PDS Collection Name

`ListsService` writes list item records to users' PDS. Update:
- Import path and names (same as ingester)
- The `collection` field in `agent.com.atproto.repo.putRecord` calls
- The `collection` field in `agent.com.atproto.repo.deleteRecord` calls

The Prisma `listItem` queries (e.g., `prisma.listItem.findMany`, `prisma.listItem.create`) do **not** change. The Prisma model name stays `ListItem`.

### 5. UserDeletionService — Update Collection Name

`UserDeletionService` iterates over a user's PDS records and deletes them during account deletion. Update:
- Import path and names for the list item lexicon
- The `LIST_ITEM_COLLECTION` constant value used in `listRepoRecordKeys` and `tryDeleteRecord` calls

### 6. AuthService — Update OAuth Scope

`AuthService` defines `OAUTH_SCOPE` which requests PDS write permissions for each collection. Update the scope string:

```
// Before
repo:xyz.opnshelf.listItem

// After
repo:xyz.opnshelf.list.item
```

This appears in:
- `backend/src/auth/auth.service.ts` — the `OAUTH_SCOPE` constant definition
- `backend/src/auth/auth.service.spec.ts` — test expectations that assert the exact scope string

### 7. AuthService Spec — Update Scope Assertions

`auth.service.spec.ts` has three places where the exact OAuth scope string is hard-coded in test expectations. All three must be updated to reference `repo:xyz.opnshelf.list.item`.

### 8. IngesterService Spec — Update Test Data

`ingester.service.spec.ts` has a mock firehose event with `collection: "xyz.opnshelf.listItem"` and `$type: "xyz.opnshelf.listItem"`. Update both to the new collection name.

### 9. ShowsService — No Change Needed

`shows.service.ts` uses a local variable named `watchlistItem` (camelCase, singular) in the release calendar feature. This is **not** a reference to the ATProto lexicon. No changes needed.

### 10. Frontend — No Changes Needed

The frontend does not reference the ATProto collection name directly. It only uses the generated API client and Prisma-derived types. No frontend files are affected.

### 11. Prisma Model — Unchanged

The Prisma schema `ListItem` model and all `prisma.listItem.*` queries remain exactly as they are. The rename is strictly the ATProto lexicon/NSID level.

## Testing Decisions

### Backend Tests

- `lists.service.spec.ts` — verify that `addItemToList` and `removeItemFromList` still work. The PDS mock should receive `collection: "xyz.opnshelf.list.item"` in `putRecord` and `deleteRecord` calls.
- `ingester.service.spec.ts` — verify the firehose handler still routes `xyz.opnshelf.list.item` events correctly. Update the mock event collection and $type.
- `auth.service.spec.ts` — verify the OAuth scope string contains the new collection name.

### Test Prior Art

The backend uses Jest with NestJS `Test.createTestingModule`. Look at the existing `lists.service.spec.ts`, `ingester.service.spec.ts`, and `auth.service.spec.ts` for mocking patterns.

## Out of Scope

- Renaming the Prisma `ListItem` model to `ListItem` → no change needed there
- Frontend changes — no frontend code references the ATProto collection name
- Database migration — the Prisma schema is untouched
- Any behavioral changes to lists functionality — this is a pure identifier rename
- Updating the `review.like` lexicon (that is a separate feature PR)

## Further Notes

### Lexicon Build Command

The regeneration command is:
```bash
cd backend && pnpm run lex:build
```

This runs:
```bash
lex build --lexicons ../lexicons --out ./src/lexicons --clear && pnpm format
```

After running it, verify that:
1. `backend/src/lexicons/xyz/opnshelf/listItem.ts` no longer exists
2. `backend/src/lexicons/xyz/opnshelf/list/item.ts` exists with the correct `$nsid = 'xyz.opnshelf.list.item'`
3. `backend/src/lexicons/xyz/opnshelf.ts` exports `list.item` instead of `listItem`

### Build Verification

After all changes, run `pnpm run build` in the backend package to ensure there are no TypeScript compilation errors from stale imports.

### Order of Operations

1. Rename/move the JSON lexicon file and update its `id` field
2. Run `pnpm run lex:build` to regenerate TypeScript
3. Update all source file imports and constants (ingester, lists service, user deletion, auth)
4. Update all test expectations (auth spec, ingester spec)
5. Run tests to verify nothing is broken
6. Run build to verify no compile errors
