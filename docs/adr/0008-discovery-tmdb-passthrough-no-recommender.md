# Discovery similarity is TMDB-passthrough; no homegrown recommender (yet)

For "better discovery" (#88) we surface similar/recommended titles by proxying TMDB's
`/recommendations` (falling back to `/similar`) rather than building our own
similarity algorithm over opnshelf's local Watches/Ratings. TMDB's results are
collaborative-filtering over its entire global userbase and need zero new data,
whereas our local dataset is currently too thin to produce a similarity engine that
isn't embarrassing. This is why the detail-page "Similar" rows become a passthrough
(they were previously fed by the generic popular `discover` endpoint, which was never
actually per-title), and why we deliberately do **not** cache TMDB genres or build a
recommendations table.

The one place we use our own data is the genuinely differentiated signal TMDB can't
know: the **"From the people you follow"** Discover section, computed from the local
follow graph (a follow's Watch, or Rating ≥7, on a title you haven't tracked).

## Status

accepted

## Considered options

- **TMDB passthrough (chosen)** — best results, no new data, no maintenance.
- **Network-scoped collaborative** ("fans of X you follow also watched…") — deferred:
  on a small follow graph the (your follows ∩ watchers-of-X) intersection is usually
  0–2 people, so the row is routinely empty.
- **Global custom recommender** over all opnshelf users — deferred until data density
  justifies it. Revisit this ADR when that happens; it's the trigger to start caching
  genres / building a recs table.
