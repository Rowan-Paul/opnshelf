# Backfill catalogue colors

Shelf list reads use stored palettes and never download posters. Movie and show
upserts already extract and persist palettes, including when existing colors are
NULL. Older records that are never hydrated again need a one-time backfill before
rolling out the persisted-only Shelf read path.

With Node.js 24 and dependencies installed, supply the intended database's
`DATABASE_URL` through the operator's environment, then run from the repository root:

```sh
node scripts/backfill-catalogue-colors.cjs
```

The command does not load any `.env` file. Running it against a hosted database
requires explicit operator approval. It downloads posters through the existing
color extraction service and updates movie and show records with SQL or JSON NULL
colors in batches of 100. Records without posters are left alone. Concurrent
palette or poster changes are preserved.

The output reports updated records and failed extractions. Failed extractions stay
NULL; a nonzero exit status signals that the command should be retried. Keyset
pagination advances past failures, and reruns skip records already repaired.
