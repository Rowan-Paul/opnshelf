# WYSIWYG review editor with markdown as the source of truth

Writing raw markdown is intimidating for non-technical reviewers, so the web review editor (`apps/web/src/components/ReviewDialog.tsx`) moves from a plain `<textarea>` + Write/Preview toggle to a WYSIWYG editor. Reviews are `site.standard.document` / `at.markpub.markdown` records that must stay portable and re-renderable across the standard.site ecosystem (see ADR-0002), so the editor's canonical format **must** remain clean markdown that round-trips losslessly — `stored markdown → edit → stored markdown` — rather than a proprietary rich-text model exported to markdown at the edges.

We chose **Milkdown (headless core)**: it is ProseMirror-based but its markdown engine is `remark`, so round-trip is the library's design rather than a bolt-on, and headless mode lets us style it with Tailwind/shadcn. Feature surface matches the existing renderer plus links (headings, bold, italic, inline code, code blocks, blockquotes, lists, links — pure CommonMark, no GFM). The read path is unified on the **same `remark` engine** via `react-markdown`, replacing the hand-rolled `MarkdownPreview` parser, so author / stored / reader / ecosystem all agree on what the markdown means. The editor mounts **client-only** (it touches the DOM and can't SSR); review *content* still server-renders through `react-markdown`.

## Considered options

- **Tiptap / Lexical / Slate** — rejected. Their canonical model is HTML or proprietary JSON; markdown is a lossy import/export, which would silently corrupt records on every re-edit and break portability — the one property ADR-0002 exists to protect.
- **Raw ProseMirror + `prosemirror-markdown`** — viable (markdown round-trip is possible), but we'd hand-maintain the serializer, toolbar, keymaps, and input rules. Milkdown gives the round-trip from `remark` for free at this feature scope. Fall back to this only if Milkdown's abstractions get in the way.
- **Keep the hand-rolled `MarkdownPreview` parser for reads** — rejected. Authoring via `remark` while reading via a second engine reintroduces author/reader divergence on edge cases.

## Consequences

- Affordances: visible toolbar (primary, since the audience is markdown-averse) + selection bubble menu for inline; markdown input rules left enabled but unadvertised. No slash commands.
- The Milkdown + ProseMirror + remark bundle is lazy-loaded with the review dialog, kept off initial page load.
- Mobile parity is **out of scope** here — ProseMirror doesn't run in React Native. Tracked in GitHub issue #131, carrying the same markdown-source-of-truth contract.
