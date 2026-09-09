# ADR 0023: Mobile routes match the Web App's URLs

The **Mobile App**'s detail routes were id-only (`/movie/[id]`, `/show/[id]`,
`/person/[id]`) while the **Web App**'s are plural and slugged
(`/movies/{id}/{slug}`). Capturing `opnshelf.xyz` links (ADR 0022) needs one URL
shape across both clients, so we renamed the mobile routes onto the web's rather
than translating between them at the deep-link boundary. **Home** also moved
from `/dashboard` to `/` on web, matching the mobile Home tab and retiring the
last URL that still used a word the glossary had dropped.

## Consequences

- Every mobile navigation now has to build a slug, so media-reference DTOs that
  carried no media title now carry one, and the `title` / `mediaTitle` split
  between sibling DTOs is unified on a single field name.
- A translation layer between the two URL shapes would have been the smaller
  change. We rejected it because it leaves two shapes alive and a mapper to keep
  in sync every time either side gains a route.
- `/dashboard` and the `/following` redirect are removed. Old bookmarks to
  either break; both are signed-in surfaces with no search traffic to lose.
