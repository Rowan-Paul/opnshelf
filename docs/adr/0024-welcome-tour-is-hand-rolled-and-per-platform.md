# ADR 0024: The Welcome Tour walks the real app, and is hand-rolled on both clients

New users finish **Onboarding** knowing how to set a timezone and nothing about
where anything is. **Discover**, **Connections**, **Activity**, **Up Next** and
**Shelf** are each one tap away and none of them announce themselves, and the
two gestures the **Mobile App** hides completely — long-press quick actions on a
media card, shake-to-feedback — have no on-screen affordance at all. We add a
**Welcome Tour** that runs after Onboarding, over the live app.

## One step list, one platform tail

ADR 0023 gave both clients the same routes and the glossary gives both the same
names, so the orientation half of the tour is identical on web and mobile. Only
the tail differs, because only the tail is about a client's own input model.

1. **Discover** — where to find films and shows
2. Platform tail — mobile: long-press a media card for quick actions, then shake
   for feedback. Web: ⌘K opens search, and feedback lives inside it.
3. **Connections** — where to find people
4. **Activity** — what the people you follow are watching
5. **Up Next** — the next episodes in your shows
6. **Shelf** — everything you have watched

The tail sits at position 2 rather than last on purpose. It is what the issue
was originally about, and a step that only the people who never skip will reach
is a step that does not exist. Discover is also the only surface with guaranteed
media cards on a fresh account, so the long-press step anchors there instead of
needing data the user does not have yet.

## The tour navigates

Each step drives the app to its real surface rather than pointing at the way in
from **Home**. Pointing at a tab bar teaches the tab bar; walking onto Discover
teaches Discover. The cost is that every step is now a navigation followed by a
layout race, so:

- Tour state lives above the router — `__root.tsx` on web, above the tabs layout
  on mobile — because it has to survive route changes.
- Each step waits for its target to mount and lay out before measuring. If it
  has not appeared within a short timeout, the step shows its card unanchored
  rather than dropping out of the sequence.
- Android's hardware back steps the tour backwards, and backs out of the tour
  entirely on the first step. Leaving it to the router would strand an overlay
  on a screen the tour did not choose.
- Finishing or skipping returns the user to **Home**.

## Every step anchors to something structural

A step points at a page header, a tab entry, or a section header — never at
content. A brand-new account has an empty **Shelf**, an empty **Up Next** and
often no follows, so a step anchored to data would either miss or spotlight a
skeleton. The copy carries the empty case ("Up Next fills in as you watch
shows"), and the same step works unchanged on day one hundred.

## Hand-rolled, not driver.js

driver.js was the issue's suggestion. React Native cannot use it, so we are
writing the overlay regardless, and the web half of that same component is the
smaller one (`getBoundingClientRect` instead of `measureInWindow`). Adopting it
for web alone would buy a dependency, its stylesheet, a client-only guard under
TanStack Start SSR, and a workaround for cmdk's focus trap on the step that
points inside the ⌘K palette — while still leaving two tour implementations to
keep in step.

## Seen-state is two versioned columns

`User` carries a tour version per client, following the `atStoreReviewHandledAt`
precedent. One shared column would mean whoever took the web tour never sees the
mobile one, and the mobile one carries the gestures. The value is an int, and
bumping it replays that client's whole tour rather than only its new steps;
partial replay needs per-step state and is not worth it.

New users flow from the last Onboarding step into the tour. Existing users get
the same full tour, once, on their next **Home** visit.

## As built

Two details settled during the build.

**Up Next and Shelf stay on Home.** Both steps point at the section header on
Home rather than walking to the drill-down page. On the **Mobile App** those two
pages put their title in the native stack header, which the overlay cannot
measure, so there was nothing on-screen to anchor. The tour therefore visits four
surfaces (Discover, Connections, Activity, Home) and ends where it finishes.
Home holds those sections below the fold, so the tour scrolls its own target into
view; Home hands its scroll view over for that.

**The web tail points at the ⌘K button, not into the palette.** The button
carries the shortcut on its face, and pointing at it keeps the tour clear of
cmdk's focus trap.

## Consequences

- The tour is authed-only. Long-press quick actions are gated on
  `isAuthenticated`, so touring a guest teaches a gesture that does nothing.
  Mobile guests get it after they sign in.
- Existing users are pulled across five surfaces mid-session, losing scroll
  position and whatever they were doing. We accept this to keep one step list
  and one code path; the alternative was branching the sequence on
  `onboardingCompletedAt` age.
- Six steps is long, and most of the skips will happen. Skip is on every step and
  counts as completed, because a tour that re-nags is the failure mode this
  pattern is known for. A Settings entry re-runs it, which is the only cheap
  recovery for the people who skipped and later needed it.
- Section and page headers are now load-bearing. A component that returns `null`
  when it has no data breaks its step, so the previews must render their header
  in the empty state.
- Shake cannot be demonstrated in a dev build: `ShakeToFeedback` disables itself
  under `__DEV__` because shake opens the React Native dev menu. That step is
  verified on a preview build or not at all.
- Making the quick-actions sheet visible instead (a `⋯` button on the card) would
  have needed no tour, no overlay and no seen-state, and would keep teaching
  users who join after the tour runs. We rejected it to keep the card corner free
  and long-press as a shortcut.
