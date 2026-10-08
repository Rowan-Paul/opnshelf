# ADR 0045: Private Settings use an opt-in Space

Update: [ADR 0048](0048-privacy-alpha-uses-reference-spaces.md) supersedes the
Settings experiment and conditional-private-deletion release requirements.
The text below records the earlier decision.

Status: superseded by ADR 0048; Settings experiment retired.

A User may connect **Private Settings** to keep their `timeFormat` preference in
an owner-controlled AT Protocol Space. The integration is disabled unless the
backend sets `ENABLE_ATPROTO_SPACES=true`. This first trial carries one setting;
Circles retain the Postgres-only boundary of ADR 0010.

The Space is `at://<owner>/space/xyz.opnshelf.settings/self`. The owner's repo
contains `xyz.opnshelf.privateSettings/self`. No private record is sent to the
public repository, Tab, a public index or an AppView. Both policies use
`memberListPolicy`; before saving, Opnshelf checks that no other member is
present. The owner/PDS can still change policy outside Opnshelf. This is access
control, not encryption, and the experiment must use disposable data.

ADR 0030 governs connection, declined grants, reconnection and disconnect: one
cumulative OAuth session, an account-wide preference, atomic replacement after
checking the complete grant, and sign-in again on other devices. Spaces scopes
are declared in client metadata but never included in Core sign-in by default.
Only this Space type and collection, plus Space creation, are requested.
Authenticated PDS requests use the OAuth session's fetch handler for DPoP,
audience selection and refresh rather than extracting bearer tokens.

When connected, settings reads fetch the private record and retain its last
valid value in Postgres for existing application consumers. Unavailable,
missing, unsupported and permission-required states are returned explicitly;
a failed remote write never reports a successful local save. Missing records
are not recreated on reads: saving the current format or changing it is an
explicit write. Only valid `12h` or `24h` records update the local value.

Deleting the private copy retains the last local preference and the OAuth grant.
Disconnecting downscopes OAuth and leaves the private copy on the PDS. The account
deletion job with PDS deletion enabled removes a known private copy before public
records; if access has been disconnected it fails until the User reconnects.
Deleting only the local account leaves PDS data as requested. A small persisted
`privateSettingsHasCopy` marker tracks copies created or read by this app.

Web and Mobile provide matching controls under Settings → Preferences. No
native configuration or Mobile version change is required (OTA-compatible).
The feature remains off until a separate operator-approved rollout. Staging
shares the production PDS and is not a disposable test environment (ADR 0021).
