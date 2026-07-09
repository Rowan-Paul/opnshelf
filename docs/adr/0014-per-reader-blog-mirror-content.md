# ADR-0014: Per-reader blog-mirror content (Leaflet, Offprint)

**Status:** Partially implemented — Standard Markdown and Leaflet; Offprint pending listing probe
**Extends:** [ADR-0013](0013-reviews-as-opnshelf-lexicon-with-optional-blog-mirror.md)

## Context

ADR-0013 mirrors a review to an optional `site.standard.document` on the user's
publication. Today we write the body as `content.$type = at.markpub.markdown`
(portable markdown) plus a `textContent` plaintext fallback.

`site.standard.document` is a shared **envelope** (site, title, path,
description, textContent, publishedAt, and an **open `content` union**). Readers
discover/list any document on their publication and can read the metadata +
`textContent`, but each renders only the `content.$type`(s) it implements and —
observed — does **not** fall back to `textContent` for the body.

Evidence (all on `did:plc:p3qed3bkmcjrmf5msnuwjdtp`, same author):

| App | `content.$type` | body shape | renders our markdown? |
| --- | --- | --- | --- |
| opnshelf | `at.markpub.markdown` | `{ text: { markdown }, flavor }` | — |
| Leaflet | `pub.leaflet.content` | `pages[] → …#block → blocks.text` | **no** (blank) |
| Offprint | `app.offprint.content` | `items[] → block.text` | **no** (blank) |

Leaflet and Offprint are structurally near-identical (a list of text blocks,
each `plaintext` + byte-offset `facets` for bold/italic/link) but namespaced
differently, so they are not interchangeable. A record's `content` holds **one**
`$type`, so a single document renders richly in at most one reader.

### Consequence

To render richly in a reader we must emit **that reader's** `content` type. A
mirror targets exactly one publication, which belongs to exactly one app, so we
only emit one format per mirror — but we need a converter per supported app.

## Decision

When configuring a blog mirror, the user explicitly selects the reader format
for that publication: **Leaflet**, **Offprint**, or **Standard Markdown**. When
writing the mirror, emit the matching `content`; Standard Markdown emits
`at.markpub.markdown`.

This selection is stored per mirror/publication and is authoritative. It makes
the compatibility trade-off visible: a reader-native rich body is intended for
the selected reader, while other readers may show only metadata and
`textContent`.

### 1. Reader-format selection, with detection as a suggestion

When the user creates or edits a mirror, inspect the target
`site.standard.publication` record and suggest a format in the UI. The user
must confirm or choose a different format before reader-native output is
enabled. Detection never overrides the saved selection and is not performed as
part of a mirror write.

Observed markers:

- **Offprint**: `theme.$type` is namespaced `app.offprint.theme` (with
  `#colors`/`#sizing`/`#effects`); repo also has sibling `app.offprint.publication`
  and `app.offprint.document.article` collections. URL host `*.offprint.app`.
- **Leaflet**: no `pub.leaflet.*` field on the record at all — only
  `site.standard.theme.basic` + plain `preferences`. Sole signal is the URL host
  `*.leaflet.pub`.

Suggestion order:

```
suggestPublicationApp(pub):
  if pub.theme?.$type starts with "app.offprint."      -> "offprint"
  else if host(pub.url) ends with ".leaflet.pub"       -> "leaflet"
  else if host(pub.url) ends with ".offprint.app"      -> "offprint"   // custom-domain safety net after theme
  else                                                 -> "unknown"
```

`theme.$type` is the robust signal for Offprint; Leaflet has none, so it relies
on the `.leaflet.pub` host. A Leaflet custom domain may have no suggestion; the
user can still explicitly select Leaflet. A mirror with no saved selection uses
Standard Markdown until the user makes one.

### 2. Converter architecture

One parse, many serialisers:

```
review markdown ──parse──▶ intermediate doc model ──serialise──▶ pub.leaflet.content
                                                    └─serialise──▶ app.offprint.content
                                                    └─(today)────▶ at.markpub.markdown
```

- **Intermediate model** (app-agnostic): an ordered list of blocks —
  `paragraph | heading(level) | listItem(ordered?) | blockquote | codeBlock |
  image(url, alt)` — where text-bearing blocks carry inline *runs*
  (`text | bold | italic | code | link(href)`).
- **Per-app serialiser** walks the model and emits that app's block/facet
  records, computing **UTF-8 byte offsets** for facets (JS strings are UTF-16 —
  offsets MUST be measured on the UTF-8 byte length, like bsky facets).
- The framed pieces from ADR-0013 (media header, "Posted with opnshelf" promo)
  become blocks too, not baked-in markdown (see §4).

### 3. Observed target shapes (to be confirmed against full lexicons)

Leaflet:
```
{ $type: "pub.leaflet.content",
  pages: [ { $type: "pub.leaflet.pages.linearDocument", id: <uuid>,
    blocks: [ { $type: "pub.leaflet.pages.linearDocument#block",
      block: { $type: "pub.leaflet.blocks.text", plaintext, facets: [
        { index: { byteStart, byteEnd },
          features: [ { $type: "pub.leaflet.richtext.facet#bold" } ] } ] } } ] } ] }
```

Offprint:
```
{ $type: "app.offprint.content",
  items: [ { $type: "app.offprint.block.text", plaintext, facets: [
    { index: { byteStart, byteEnd },
      features: [ { $type: "app.offprint.richtext.facet#italic" } ] } ] } ] }
```

We have confirmed only the text block + bold/italic facet. **Before building we
must vendor the full lexicons** (`pub.leaflet.*`, `app.offprint.*`) to learn:
link facet shape, heading/list/quote/code/image block types, and the
`linearDocument` page/`id` requirements. Source: each app's published lexicons
(atproto lexicon resolution) or by inspecting more of their records.

### 4. Media header & promo → blocks

- **Title line**: a text block "`{mediaTitle} · {type}`" with a link facet over
  the title pointing at the opnshelf media page.
- **Body**: the review markdown, converted.
- **Promo**: a text block "Posted with opnshelf — …" with a link facet.
- **Poster image**: OPEN QUESTION. The poster is a remote TMDB URL. Leaflet/
  Offprint image blocks likely reference a **blob** in the author's repo, not an
  external URL. Embedding it would mean uploading the poster as a blob per mirror
  (extra writes) — so **v1 omits the poster image block** and keeps the linked
  title only. Revisit once the image-block lexicon is known.

## Open questions (resolve before/while building)

1. **Offprint listing**: the `site.standard.document` + `app.offprint.content`
   *renders*, but does Offprint's index list documents it didn't author, or only
   its native `app.offprint.document.article`? If the latter, mirroring to
   Offprint also requires writing an `app.offprint.document.article` (a second
   record + its own body format). **Probe with a throwaway doc before committing
   to the Offprint path.** Leaflet has no sibling record, so it's unaffected.
2. **Full lexicons**: exact block/facet vocabulary for both apps (headings,
   lists, quotes, code, links, images).
3. **Custom domains** on Leaflet: v1 may not suggest Leaflet, but users can
   select it explicitly. Revisit detection if this creates meaningful friction.
4. **`textContent`**: keep emitting it (portable plaintext) regardless of the
   rich `content` — cheap and the only true cross-reader body fallback.

## Rollout / phasing

1. **Leaflet** — implemented as a single `site.standard.document` with
   `pub.leaflet.content`. Users explicitly choose Leaflet; a `.leaflet.pub` URL
   is only presented as a suggestion.
2. **Offprint** — pending a probe of its listing behaviour (open question 1); may need the
   native article record.
3. **Standard Markdown** remains the default until the user selects another format.

Text + bold/italic/link/heading/list first; images later.

## Code touch points (backend)

- Vendor lexicons: `backend/src/lexicons/pub/leaflet/*`, `.../app/offprint/*`
  (via `lex build` if we add their JSON to `/lexicons`, or hand-vendored types).
- New: `reviews/mirror/markdown-to-doc.ts` (parse → intermediate model),
  `reviews/mirror/leaflet.ts`, `reviews/mirror/offprint.ts` (serialisers),
  `reviews/mirror/suggest-app.ts`.
- Mirror configuration: persist an explicit reader-format enum per mirror or
  publication (`leaflet | offprint | markdown`), and present the suggested
  format for user confirmation.
- `reviews.service.ts`: in `syncBlogMirror`, read the saved reader-format,
  select the serialiser, and set `content` accordingly (keep
  `textContent`/metadata as-is). `buildDocumentRecord` gains a `content` param
  instead of always building markdown. A missing setting uses Markdown.
- Tests: byte-offset facet correctness (multi-byte chars), suggestion per app,
  explicit selection overriding a suggestion, and Markdown as the unset/default
  format.

## Non-goals

- A universal rich body across all readers (doesn't exist; each reader renders
  its own type).
- Editing/round-tripping the app-native content back into a review (the review
  record stays the source of truth; the mirror is derived, one-way).
