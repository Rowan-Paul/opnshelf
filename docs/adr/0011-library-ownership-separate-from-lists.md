# ADR 0011: the Library (ownership) is modelled separately from Lists (curation)

opnshelf already has **Lists** (`xyz.opnshelf.list` + `xyz.opnshelf.list.item`) — curated collections like Watchlist and Favorites, a `ListItem` join over movie/show/season/episode keyed by TMDB id. Issue #33 ("add movie to collection") asks for something that looks superficially identical — a collection of films — so the obvious move is to reuse Lists.

We do **not**. The Library is a distinct concept with its own lexicon `xyz.opnshelf.library.item` and Postgres `LibraryItem` model. A **Library Item** records "this user **owns** this Media Item in this **Format**" (Format = enum `DIGITAL | BLURAY | BLURAY_4K | DVD`, the axis the issue called "Category"); an optional `boxSet` string subdivides. Unlike Lists, the Library has **no parent record** — "Library" is an umbrella term (like _Shelf_), not a stored entity, so there is nothing analogous to the `xyz.opnshelf.list` parent. Items are unique on `(userDid, mediaType, mediaId, seasonNumber, episodeNumber, format)` with a deterministic rkey, so adding the same film+format is idempotent. As with Lists, the PDS is the source of truth and Postgres is the index.

The Library is **public** on the owner's profile (`/profile/{handle}/library`). This is not really a choice: PDS records are world-readable, so ownership data is public the moment it is written, regardless of UI — see ADR 0003. We surface it deliberately rather than pretend otherwise.

## Why

Ownership and curation are different relationships to a film, and the difference is load-bearing. A List membership is a toggle (in or out). Ownership is not: it carries a required **Format** and an optional **Box Set**, and the *same film owned in two formats is two distinct records* — a notion Lists cannot express without either a per-format hack or duplicate list entries. Folding ownership into `ListItem` would mean adding `format`/`boxSet`/multi-row-per-media semantics to a model whose entire shape assumes one membership per media per list, polluting both the lexicon and the `List` glossary entry with ownership concepts that have no meaning for Watchlist or Favorites.

Keeping them separate costs one more lexicon and model — but they are a near-exact copy of the List pattern, so the marginal code is small, and the two concepts stay independently evolvable (Lists gain sharing/ordering; Library gains box-set metadata) without each change rippling into the other.

## Consequences

- A new collection `xyz.opnshelf.library.item` is written to user PDSs and must be indexed by the ingester, alongside lists, ratings, and review documents.
- `List` and `Library` are two parallel PDS-backed media-collection systems by design. Future readers should not "consolidate" them: the split is the decision. CONTEXT.md records the distinction (List = curation, Library = ownership).
- Ownership is public. There is no private-library option, because the PDS makes the data public regardless; any future "private" feature would require not writing to the PDS at all, which would break portability.
- Box Set is a plain string on the item (no identity, no box-set-level metadata, renaming touches each item). Promoting it to a first-class entity later is a contained migration; it was deferred because issue #33 specifies nothing beyond "can be divided into box sets".
