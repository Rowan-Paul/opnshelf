# ADR 0027: Rebuild the Mobile App Fresh on Uniwind + react-native-reusables

We deleted the original Expo app (tag `v0.1.0`, removed in `487a4dd feat: initial redesign`) to focus on the web rework, and have now decided to **rebuild it from scratch** rather than revive it from git history. The new `apps/mobile` is a fresh Expo Router app styled with **Uniwind + react-native-reusables**, reusing only the framework-agnostic `@opnshelf/api` package as the shared API contract.

The obvious cheaper path was to resurrect the old app — `git checkout 487a4dd^ -- apps/mobile` brings back working auth, navigation, Trakt import, and detail screens. We rejected it for two compounding reasons. First, **design drift**: the old app was built on react-native-paper (Material 3), while the rework moved web to a custom Tailwind/shadcn token system (slate neutrals + amber accent, defined in `apps/web/src/styles.css`). Reviving it would mean re-skinning every screen anyway. Second, **API drift**: the backend gained `notes`, `social`, `feedback`, and review-likes modules since `v0.1.0`, so the old screens' data wiring would break against the current `@opnshelf/api`. Reviving meant paying for *both* a re-skin and a re-wire on top of unfamiliar inherited code.

Rebuilding fresh lets the mobile app share the web's design vocabulary directly: Uniwind is Tailwind-for-RN and react-native-reusables is the shadcn port (officially Uniwind-compatible as of its December 2025 integration), so the web token layer ports nearly verbatim, dark mode included. The trade-off is that we re-implement navigation, auth, and detail screens we already had working — but as fresh code against the current API and design system, not salvaged code fighting both drifts. We keep exactly one thing from before: `@opnshelf/api`, because the API *contract* never diverged, only its surface grew.

## Consequences

- Mobile and web stay in design lockstep through a shared token vocabulary; web design changes are portable to mobile rather than re-interpreted.
- The app is built core-loop-first (auth → search → media detail → log/rate/review → shelf); features like lists, standalone social and Trakt management beyond onboarding, calendar, person pages, and notes are deliberately deferred to v1.1+.
- We are coupled to react-native-reusables' Uniwind support. If that support regresses, the fallback is NativeWind (RNR's original target).
