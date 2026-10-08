# Trakt Sync

Design interview for [issue #260](https://github.com/Rowan-Paul/opnshelf/issues/260).
Status: agreed design implemented in the #260 working branch. Verified with local fixtures and a disposable PostgreSQL database; live Trakt/PDS round trips and deployment remain outstanding.

## Agreed scope

- The first version covers Watch history, including rewatches, and Ratings.
- Users choose Trakt → Opnshelf, Opnshelf → Trakt, or both directions.
- Sync is optional. Offer Import once alongside Keep in sync.
- Preserve existing Trakt Import results and Unmatched-item reconciliation.
- Offer setup during Onboarding and connection management in Settings on both Web and Mobile.
- Watchlist, custom Lists, Library ownership, and Reviews are outside the first version. Draft separate follow-up issues for review before posting; none have been posted.

## Agreed transfer rules

- At first connection, offer All existing history and future changes (default) or Future changes only. Merge existing history without deleting destination-only records.
- In initial two-way reconciliation, matching Ratings link automatically. Differing Ratings require a source choice, per item or applied to all, because neither service provides a reliable comparable last-edit timestamp. In one-way sync, the selected source wins.
- Propagate Watch date corrections, Watch deletions, Rating changes, and Rating removals in the selected direction for records already linked by sync. Preserve unrelated destination records. Concurrent changes on both sides since the last sync require conflict resolution.
- Private Trakt profiles may be imported. Before transfer into public Opnshelf records, require explicit acknowledgement of publication. Ship against public Watches and Ratings without waiting for the separate Spaces work. Private destinations remain outside this first sync version.
- Sync runs on the server while clients are closed. Queue outbound Opnshelf changes promptly, check Trakt approximately every 15 minutes, and expose Sync now, last-success time, and errors. Rate limits may delay completion.
- Automatically link an unambiguous one-to-one media match within the same minute, accounting for Trakt's minute precision. Preserve local timestamps and rewatch counts. Flag nearby or ambiguous matches for review. If several Opnshelf Watches cannot be represented on Trakt within one minute, preserve them locally and report the limitation; never invent timestamps.
- After linking, conflicting Rating changes on both sides require a choice. One-way sync follows its selected source.
- Pause stops transfers and catches up on resume. Disconnect revokes access without deleting transferred data. Reconnecting the same account reuses its existing links.
- Connect one Trakt account at a time. Switching requires disconnecting first and selecting initial transfer scope again. Preserve transferred records and never reuse the previous account's links for a different account.
- Unresolved items do not block other items. Provide a persistent Needs attention list for matching, conflict resolution, and retries.
- Future changes only starts when the initial background comparison finishes. It refers to when records are added or changed, not their watch dates. Newly logged historical Watches qualify; existing untouched history does not.
- Transfer No date Watches using Trakt's explicit unknown-date representation. Verify repeated No date Watch support; if not representable, retain the Watches locally and show the limitation in Needs attention.
- Provide independent enable switches for Watches and Ratings, with one shared sync direction in the first version.
- Include supported record changes made through other AT Protocol clients, with durable change tracking and prevention of sync echoes. The first version covers public records only.
- Retain account-scoped links and the last synchronized state until Opnshelf account deletion, including through disconnection. Reconcile changes on reconnect using the same conflict rules. Failed or incomplete fetches never establish deletion.
- Before changing direction, enabling a record type, or expanding history scope, show the proposed scope and offer existing data or future changes only. Keep existing links. Disabling a type stops its transfers without deleting records.
- Do not let an existing Import and sync concurrently process the same history. Offer to finish the Import first or explicitly transition to sync, retaining Import outcomes and unresolved items.
- Trakt Import retains its current meaning: one-time inbound Watch history. It does not gain Ratings or outbound transfer in this version.
- Needs attention offers Ignore this item, an Ignored view, and undo. Remember the choice across sync runs; ignored items are never reported as successfully synced.
- Opnshelf account deletion stops sync, revokes access, and removes local connection and reconciliation data. Previously exported Trakt records remain; explain this in the deletion flow.
- Initial No date Watches on both services require confirmation before linking, even for one Watch on each side. Preserve the confirmed link afterward.
- Re-enabling a record type catches up already-linked records under the existing conflict rules. History scope selects which unlinked records enter sync; explain this distinction in setup.
- Conflict resolution shows both versions and offers Use Trakt or Use Opnshelf, explicitly identifying deletion or restoration. Allow bulk choices for Rating conflicts; Watch edit/delete conflicts are individual. Ignoring a conflict suppresses it without resolving it.
- Explicitly handing an unfinished Import to sync gives it the permanent Continued in Trakt Sync status. Preserve its real progress, outcomes, and Unmatched items; never mislabel unfinished history as completed. Finish in-flight Import work before sync takes ownership, and route subsequent matching and retries through sync bookkeeping. Warn that the old Import cannot resume afterward, even after disconnecting sync. Keep Finish Import first as the alternative.

## Client parity

| Capability | Web | Mobile |
| --- | --- | --- |
| Optional Onboarding setup; Import once or Keep in sync | Included | Included |
| Settings connection, direction, types, and history scope | Included | Included |
| Sync now, last success, errors, pause, disconnect, reconnect | Included | Included |
| Needs attention, matching, conflict resolution, ignore and undo | Included | Included |
| Existing Import results and explicit handoff | Included | Included |

Both clients use shared URL shapes where the same route exists. Mobile release routing is determined during implementation; no release is authorized by this design.

## Interview outcome

No product decisions remain open in this interview. API uncertainties below are implementation verification requirements, not permission to change the agreed data-preservation rules. If verification contradicts a requirement, surface that conflict before changing the design.

Follow-up issue drafts are in [Trakt Sync follow-ups](trakt-sync-follow-ups.md). They are proposals for later work, not expanded scope for #260.

## Investigation findings

- ADR 0048 now provides private Shelf storage. Trakt Watch sync remains public-only and waits while the Shelf is private or migrating; disabling Watch sync allows public Ratings to continue. Trakt Sync never changes a category’s privacy choice.
- Opnshelf Rating database timestamps can advance during ingestion; Trakt exposes a historical, client-settable rated_at. Neither is a verified last-user-edit clock suitable for automatic initial conflict resolution.
- Trakt's [2026 history announcement](https://github.com/trakt/trakt-api/discussions/694) describes minute precision and deduplication by media and watched_at. Its [current OpenAPI document](https://developer.trakt.tv/openapi.json) still contains contradictory deduplication prose. Verify behavior in controlled integration tests before promising lossless rewatch round trips.
- The current Trakt OpenAPI document supports watched_at: "unknown" on history writes. Readback and repeated No date Watch behavior still need verification.
- Tab ingests Watch and Rating creates, updates, and deletes made by other clients. These changes are included in sync; durable change tracking and echo suppression are required.

## Implementation verification requirements

The implementation includes automated reconciliation, transport, PDS recovery, database lifecycle, and Web consent/conflict tests. Verification results and the boundary between local fixtures and live-service testing are recorded in [the runbook](../runbooks/trakt-sync.md). The following remain the acceptance criteria, including controlled live checks before rollout.

- Exercise both one-way directions and two-way sync for Watches and Ratings, independently enabled, including initial existing-history merge and future-changes-only scope.
- Verify stable record links, preservation of local Watch identity and timestamp precision, ambiguous matches, No date Watches, repeated Watches, and Trakt readback/deduplication behavior. Unsupported representations must remain visible as unresolved outcomes.
- Verify initial Rating source choices, concurrent edits, edit-versus-delete conflicts, one-way source precedence, and explicit deletion/restoration copy.
- Verify complete paginated reconciliation before detecting removals. Simulate failed pages, rate limits, ambiguous write outcomes, retries, process restarts, and duplicate ingestion; none may silently delete unrelated data or create echo transfers.
- Verify pause/resume, disconnect/reconnect, account switching, re-enabling record types, history scope changes, and account deletion. No worker may continue using revoked authorization.
- Verify Import handoff during an in-flight page, permanent retirement of the old worker, truthful historical progress, and matching/retries after handoff.
- Verify ignored outcomes, undo, retained unresolved work, publication consent, and external-client changes.
- Inspect Onboarding, Settings, and Needs attention in a browser and a Mobile simulator, including loading/error states and client parity. Follow repository verification gates for every affected workspace and generated API output.
- Use local fixtures and mocks for routine tests. Live Trakt writes, deployed PDS writes, migrations, and releases require their own explicitly authorized environment; this design does not authorize them.

## Architecture constraints

ADR 0049 allows ongoing Trakt Sync alongside the lifetime Trakt Import defined by ADR 0020. It preserves existing Import outcomes and reconciliation, including an explicit permanent handoff for unfinished Imports.

ADR 0042 preserves Watch identity through watch-date corrections. Existing import identity derives from media coordinates and the original date rather than a Trakt history-event ID. Ongoing sync therefore needs deliberate event linkage and cannot safely be implemented by repeatedly restarting the existing importer.
