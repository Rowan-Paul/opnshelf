---
name: always-use-mutation-keys
description: Enforce stable `mutationKey` usage for TanStack Query and React Query mutations. Use when adding, editing, reviewing, or refactoring `useMutation` calls, mutation option factories, or shared data hooks so every mutation has an explicit key that follows this repo's array-based naming pattern.
---

# Always Use Mutation Keys

## Overview

Add an explicit `mutationKey` to every mutation definition you touch.
Treat a missing key as incomplete work, even when the mutation function comes from a generated helper like `...Controller...Mutation()`.

## Rule

Write mutations in object form and place `mutationKey` near the top of the options object.

```ts
const markMutation = useMutation({
  mutationKey: ["movies", movieId, "markWatched"],
  ...moviesControllerMarkWatchedMutation(),
})
```

Do not rely on inference. If the mutation exists, give it a key.

## Key Shape

Use array keys, not free-form strings.

- Start with the top-level resource.
- Add the concrete identifier when the action is scoped to one entity.
- Add nested resources when the mutation targets a child entity.
- End with the action name.
- Keep every segment serializable and stable.

Prefer patterns already used in this repo:

```ts
["movies", movieId, "markWatched"]
["movies", movieId, "deleteWatchEntry"]
["shows", showId, "markShowWatched"]
["shows", showId, "episodes", episodeNumber, "markWatched"]
["shows", showId, "episodes", episodeNumber, "unmarkWatched"]
["shows", showId, "episodes", episodeNumber, "deleteWatchEntry"]
```

## Naming Guidance

- Reuse the same resource nouns that nearby query keys and route params use.
- Keep sibling mutations on the same prefix and vary only the action suffix.
- Include IDs, slugs, season numbers, or episode numbers when they define the mutation scope.
- Avoid transient values such as timestamps, freshly allocated objects, functions, or display labels unless they are part of the mutation identity.

## Workflow

1. Search the files you touch for `useMutation(` and any helper that returns mutation options.
2. Add or verify `mutationKey` before adjusting invalidation, optimistic updates, or callbacks.
3. If several mutations live together, normalize them into one consistent key family.
4. Before finishing, review the touched mutations and confirm none are missing keys.

## Review Checklist

- Every touched mutation has an explicit `mutationKey`.
- Each key is array-based, stable, and serializable.
- The key identifies both scope and action.
- Generated mutation helpers are wrapped with a local `mutationKey` when used with `useMutation`.
- New keys match existing repo patterns instead of inventing a parallel naming scheme.
