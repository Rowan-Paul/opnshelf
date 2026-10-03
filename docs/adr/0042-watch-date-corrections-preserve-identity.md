# ADR 0042: Watch date corrections preserve identity

Status: Accepted; implemented (issue #336).

A User may correct a Watch's date and time, clear it to **No date**, or give an
undated Watch a date. Every such correction preserves the Watch's identity,
including its AT Protocol record key. It changes the existing record rather
than deleting and recreating it.

Interactive logging already creates fresh TID keys (ADR 0009). Trakt Import
instead derives deterministic keys from the original media coordinates and
watch timestamp to make crash recovery idempotent. That derivation chooses
the key at creation; it is not an invariant tying the key to the record's
current date. An imported Watch retains its original key after a correction,
allowing recovery to recognize it as already imported.

A User's correction must survive later import retries. The former import
writer's create-conflict fallback unconditionally overwrote existing records
with the original import payload. Recovery now creates missing records and
reads existing records at their original keys, indexing the saved watch date
without overwriting a local Watch that already exists. This preserves edits
even when recovery began before the correction.

This protection applies to import recovery, not competing User edits. Those
use last successful write wins without client revision preconditions or a conflict-resolution
interface; preserving identity does not require a new edit-concurrency system.

Recomputing the key on each correction was rejected: it breaks references to
the Watch and lets recovery recreate the original imported Watch. Replacing
deterministic import keys altogether was also rejected because their creation
idempotency remains useful. The cost of preserving identity is that a key may
encode a former date, and recovery must distinguish existing records from
records it still needs to create rather than assuming identical content.
