# Trakt Favorites investigation

Checked 15 October 2026. Original investigation only: no account writes or PR changes. The subsequent Favorites implementation follows the recommendation below, holding private outbound transfers pending privacy verification.

## Finding

Opnshelf's default Favorites List corresponds to Trakt's dedicated **Favorites** feature. Trakt distinguishes Favorites from both personal Lists and watchlist; it is not necessary to create a personal List named Favorites to represent it. [Current Trakt introduction](https://developer.trakt.tv/)

At investigation time, Favorites was missing from both the existing one-time Trakt Import and the List sync implementation in PR #493. The former reads watched history; the latter covers custom Lists and watchlist. These are separate gaps, not evidence that Trakt requires a separate import mechanism.

## Current repository behavior

| Area | Evidence |
| --- | --- |
| Default Favorites is an Opnshelf List with slug `favorites`. | [lists.service.ts](../../backend/src/lists/lists.service.ts#L57) |
| Public and private List sync explicitly selects only the default watchlist, excluding default Favorites. | [local-lists.service.ts](../../backend/src/integrations/local-lists.service.ts#L162), [private selection](../../backend/src/integrations/local-lists.service.ts#L189) |
| Remote List sync reads personal Lists and watchlist, with no Favorites adapter. | [remote-lists.ts](../../backend/src/trakt-sync/remote-lists.ts#L146) |
| Reconciliation supports `watch`, `rating`, `list`, and `watchlist`. | [reconcile.ts](../../backend/src/integrations/reconcile.ts#L6) |
| One-time Import fetches Trakt watched history. | [trakt-api.client.ts](../../backend/src/users/trakt-api.client.ts#L61) |
| The accepted decision explicitly leaves Favorites separate. | [ADR 0049](../adr/0049-trakt-sync-links-records-alongside-one-time-import.md#L23) |

## Official API facts

The current official contract defines a separate OAuth-protected Favorites router. The source inspected is pinned to commit `f4d56611c7b116c570c8b137a7598408413505cf`.

| Operation | Method and path |
| --- | --- |
| Read | `GET /sync/favorites/:type/:sort_by/:sort_how` |
| Add | `POST /sync/favorites` |
| Remove | `POST /sync/favorites/remove` |
| Reorder | `POST /sync/favorites/reorder`, ordered List item IDs |
| Update item | `PUT /sync/favorites/:list_item_id`, accepts notes/rank |

Reads accept pagination. Add/remove support movies and shows, excluding seasons and episodes. The write operations are OAuth-required and are not marked VIP-only. Add documentation describes optional item notes with a 500-character maximum, but its request schema currently only models IDs; verify payload behavior before implementing note transfer. [Sync contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/index.ts#L452), [request schema](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/schema/request/favoritesParamSchema.ts)

Do not hard-code a numeric Favorites cap from documentation prose: the add description mentions 50, while the user-read description mentions 100. The contract documents HTTP `420` on exceeding the Favorites limit and says the limit applies to all users. Settings explicitly expose `limits.favorites.item_count`, separately from List and watchlist limits. Use the connected account's returned limit and handle `420`; a VIP upgrade must not be promised as the remedy. [Sync contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/index.ts#L467), [user Favorites contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/subroutes/favorites.ts#L87), [settings schema](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/schema/response/settingsResponseSchema.ts)

The inspected Favorites writes provide no per-Favorites privacy setting. Settings expose account-level `user.private`, but these contracts alone do not establish every Favorites visibility rule for public/private accounts. Confirm effective visibility before supporting private Opnshelf Favorites outbound; do not claim a private Opnshelf List automatically stays private on Trakt. [Sync contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/index.ts#L452), [settings schema](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/schema/response/settingsResponseSchema.ts)

## Recommendation, not an implemented decision

Add an independently opt-in Favorites sync scope and pair Opnshelf's default Favorites List to Trakt Favorites **by role**, as watchlist does. Retain the existing shared publication acknowledgement. Reuse List reconciliation for membership/order/conflicts where its semantics fit, with a dedicated Trakt adapter.

Treat unsupported seasons/episodes and account-cap failures as Needs attention. Never promote a season/episode to its parent show or truncate a List to fit Trakt. Privacy, metadata representability, and note writes need explicit handling before implementation. Updating ADR 0049 would be part of accepting this extension.

A one-time Favorites Import could use the read endpoint, but is a separate product choice; it is not needed merely to add ongoing Favorites sync. No code gates were run for this documentation-only investigation.
