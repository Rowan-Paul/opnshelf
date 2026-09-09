# ADR 0016: Spoiler Flag is whole-review, and the title sits outside the spoiler boundary

Reviews gain an author-declared Spoiler Flag: an optional `spoiler: boolean` on `xyz.opnshelf.review` (absent = no spoilers, so all pre-existing records and third-party writers degrade safely). We chose whole-review granularity over inline spoiler spans because inline markup would live inside the markdown `content` and render as literal garbage in every consumer that doesn't implement it — including all three blog-mirror formats (ADR-0014) and any third-party lexicon reader; a boolean can be extended with inline spans later, the reverse is a breaking retraction.

The review **title is outside the spoiler boundary** by author contract (the editor says so when flagging): it stays visible on every surface, including the Bluesky Cross-post, which remains unchanged for flagged reviews. Readers get a Spoiler Shield (tap-to-reveal, ephemeral, suppressible via an account-level "always show spoiler content" setting) wherever the body renders — excerpt cards, detail pages, activity feeds. Surfaces that cannot shield interactively — the blog mirror — publish the full body prefixed with a spoiler warning block, and the warning replaces the body excerpt in the document's `description`/`textContent`: the author's own blog audience gets warned full text, never a stub, because they pulled the page open (unlike the Cross-post, which pushes into feeds).

## Considered Options

- Inline spoiler spans (Trakt comments, Discord `||…||`) — rejected: unrenderable-by-default markup in a federated record.
- Hiding the title on flagged reviews / dropping it from the Cross-post — rejected in favour of author responsibility; lists need an identifier and the compose flow stays uniform.
- Not mirroring flagged reviews, or mirroring a link-only stub — rejected: punishes honest flagging and guts the mirror's purpose.
- Scoped spoilers (`upTo: S2E5`) — deferred; reader watch-state logic can arrive later as an optional sibling field without breaking the boolean.
