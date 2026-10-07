# User-controlled data privacy

Status: product direction agreed on 2026-10-06; not implemented. Related: #252,
PR #449 and ADR 0046. PR #449 implements only the private time-format trial.

## Controls

Ask Users which categories they want to keep private. Provide matching controls
on Web and Mobile, available again in Settings so choices can be changed later.

| Category | Agreed control |
| --- | --- |
| Watches | One Public / Private choice for all Watches |
| Lists | Default visibility for Lists, with a choice for each List |
| Library | One Public / Private choice for all Library Items |
| Notes | One Public / Private choice for all Notes |
| Settings | Always private; optional PDS sync |

No individual Watch, Library Item or Note overrides in the first version.
A List's visibility covers its contents as well as its name and description.
Sharing with selected people is outside this version: Private means owner-only.
Reviews, Ratings, profile, Follows and Review Likes retain their existing
behavior; this agreement does not change their visibility. Circles remain under
ADR 0010 and are not implicitly included in this migration.

Visibility and sync are separate controls. Disabling Settings sync never
publishes Settings. Turning off private visibility for content means publishing
it and requires explicit confirmation.

## Initial visibility

New Users start with Public Watches, Public Library and Public Notes, and Public
as their Lists default. Users can choose Private later through the same controls.
Settings remain private; this public default does not enable Settings sync.
Existing Users retain their current visibility until they explicitly change it.

## Changing visibility

Public → Private copies records into owner-only Spaces, removes their public
records and removes them from Opnshelf's public surfaces. Explain that previously
published copies may remain outside Opnshelf; this cannot promise retroactive
secrecy. Private → Public publishes records only after confirmation.

Show migration progress and a recoverable failure state. Preserve data and stable
relationships; never claim completion while records remain in the wrong location.
Repeated requests and interrupted migrations must be safe to resume. Define
concurrent writes and visibility changes during an active migration before coding.

Private Watches must not leak through Activity, Shelf, counts, statistics or
Up Next. Private Lists, Library Items and Notes must be excluded from public APIs,
search, previews and cached public responses. Audit widgets, notifications and
other derived surfaces as well as primary pages. Public content that independently
reveals related information is not silently made private by another category's
switch; explain these boundaries in the confirmation flow.

## Decisions still needed

- Timing and presentation of the privacy prompt. New Users' public defaults are
  agreed; make visibility clear without silently migrating existing content.
- Whether changing the Lists default affects only future Lists or also offers
  a separate bulk change for existing Lists.
- The exact Settings fields included in portable sync, and what happens to an
  existing private copy when sync is disabled or re-enabled.
- Storage layout, synchronization authority, conflict handling, offline writes,
  OAuth permissions, and safe migration sequencing across public and private stores.
- Behavior for PDSs without Spaces support; private data must never fall back to
  public storage.

## Implementation stages

1. Inventory owned records, references and all public/derived readers. Settle the
   remaining migration and default decisions; define resumable transitions.
2. Build the privacy state and migration mechanism with failure/retry coverage.
3. Apply category controls and per-List visibility across backend, Web and Mobile,
   including public-read filtering and cache invalidation.
4. Verify a second account and signed-out readers cannot access private data;
   exercise both migration directions, interruption, conflicting edits and failures
   on the real local stack before any separately approved rollout.
