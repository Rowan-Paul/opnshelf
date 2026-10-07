# User-controlled data privacy

Status: alpha replacement agreed on 2026-10-07; implementation in progress.
Related: #252, ADR 0046 and ADR 0048. Superseded experimental PR #449 is closed.

## Controls

Ask Users which categories they want to keep private. Provide matching controls
on Web and Mobile, available again in Settings so choices can be changed later.

| Category | Agreed control |
| --- | --- |
| Watches | One Public / Private choice for all Watches |
| Lists | Default visibility for Lists, with a choice for each List |
| Library | One Public / Private choice for all Library Items |
| Notes | One Public / Private choice for all Notes |
| Settings | Ordinary private account preferences; no experimental PDS sync |

No individual Watch, Library Item or Note overrides in the first version.
A List's visibility covers its contents as well as its name and description.
Sharing with selected people is outside this version: Private means owner-only.
Reviews, Ratings, profile, Follows and Review Likes retain their existing
behavior; this agreement does not change their visibility. Circles remain under
ADR 0010 and are not implicitly included in this migration.

The Privacy screen and onboarding identify the feature as Alpha. Onboarding
starts with one Public/Private choice (Public preselected), with category
customization. Private authorization occurs within this flow. Declining it keeps
the previous visibility; no connection-control step is exposed. Unsupported PDSs
keep Public usable and explain why Private is unavailable.

A Lists default change applies only to new Lists. Existing Lists retain their
visibility; a separate bulk action changes all Lists. The release covers all four
categories, with matching Web and Mobile flows and no placeholder controls.

## Initial visibility

New Users start with Public Watches, Public Library and Public Notes, and Public
as their Lists default. Users can choose Private later through the same controls.
Settings remain private account preferences. Remove the experimental sync code
and its private Settings records and Space, preserving ordinary preferences.
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

## Alpha migration contract

Use reference Spaces endpoints, never require a Tranquil-only capability. Copy
and verify complete records, retain a temporary recovery journal, recheck the
source, then delete originals. Public-source CAS remains supported. Private
cleanup cannot close the race with an external app editing after the last check;
this is an accepted alpha limitation documented in Learn more, without an extra
concurrency warning. Detected conflicts stop the job; permanent private backups
are not the product behavior. Ordinary switching deletes migrated records, not
whole content Spaces. Pause affected category edits while migration runs.

## Implementation stages

1. Inventory owned records, references and all public/derived readers. Settle the
   remaining migration and default decisions; define resumable transitions.
2. Build the privacy state and migration mechanism with failure/retry coverage.
3. Apply category controls and per-List visibility across backend, Web and Mobile,
   including public-read filtering and cache invalidation.
4. Verify a second account and signed-out readers cannot access private data;
   exercise both migration directions, interruption, conflicting edits and failures
   on the real local stack before any separately approved rollout.
