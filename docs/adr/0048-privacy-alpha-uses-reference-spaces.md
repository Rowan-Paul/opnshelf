# ADR 0048: Privacy alpha uses reference Spaces

Status: accepted by the operator on 2026-10-07. Supersedes ADR 0045's Settings
sync experiment, ADR 0046's conditional-private-deletion release prerequisite,
and ADR 0047's Tranquil-specific capability requirement.

Privacy is an explicitly labeled alpha supporting the reference Spaces API and
compatible PDSs. Tranquil-only extensions cannot be required. New Users see one
Public/Private choice during onboarding, initially Public, with category
customization. A dedicated Privacy settings screen exposes Shelf, Library,
Notes and Lists on both clients. All four categories must work before release.
Authorization is part of choosing Private, not a separate connection control.
Unsupported PDSs retain Public behavior and explain why Private is unavailable.

Category changes include existing records. Lists additionally have an individual
visibility. The Lists choice prompts for New Lists only or All Lists; the latter
changes existing Lists and the default together. Individual controls and recovery
remain available in a Manage individual Lists modal. Reviews, Ratings and other
categories retain their existing behavior. Publication requires confirmation. Migration progress and
recovery are visible, with edits paused only for the affected category.

The current reference Spaces API has no private-record conditional deletion.
For this alpha, copy/create the destination, verify the complete record, retain
the temporary recovery journal, recheck the source, and delete the private
original using the reference API. Stop on detected conflicts. This knowingly
cannot prevent another authorized app editing between the last check and delete;
it must not be described as atomic or race-free. The operator accepts that alpha
limitation without a separate concurrency warning. Keep that limitation documented
here; the settings screen does not need a Learn more disclosure.
Do not retain permanent private backups or delete whole content Spaces as part
of a visibility switch. Existing public-source CAS remains useful and portable.

Remove the experimental Private Settings integration, including its connection
controls, record and Space. The operator confirms the experiment contains no
user data requiring retention and authorizes that cleanup. Preserve ordinary
account timezone and 12/24-hour preferences. Content Spaces are unrelated to
that cleanup and must not be deleted by it.

Reference evidence: the Spaces alpha deleteRecord lexicon at
[5b95b2f](https://github.com/bluesky-social/atproto/blob/5b95b2f2723a2882824fbb0b819fd6aad884ef20/lexicons/com/atproto/space/deleteRecord.json)
contains no swap precondition; applyWrites is confined to one Space repository.
The [alpha announcement](https://atproto.com/blog/atproto-spaces-alpha) describes
the separate reference alpha PDS. Compatibility must be tested against that
implementation, not inferred solely from Tranquil tests.

Once a category has changed visibility, authoritative repository polling continues
for that category even after returning to Public. This extends ADR 0047's handover
to all alpha categories so delayed stream events cannot restore removed data.
The alpha worker processes five records per migration batch and one migration
plus one sync per tick; large imports may take time, with progress shown in Privacy.

The legacy `/users/me/watch-privacy` routes remain as a compatibility endpoint
for previously installed clients during the alpha replacement. New clients use
`/users/me/privacy`; both delegate to the same Watch migration service. The
stored `watchPrivacyEnabled` name now denotes the saved all-category grant
preference, not the visibility of any category.

Retiring the old Settings Space requires the reference `manage=delete` grant.
Only accounts with the old experiment request that cleanup grant on reauthorization;
accounts without it defer cleanup rather than repeatedly prompting. Deleted Lists
retain their Space identity for eventual account cleanup but stop background polling.
