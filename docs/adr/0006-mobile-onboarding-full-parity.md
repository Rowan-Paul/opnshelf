# ADR 0006: Mobile onboarding mirrors web's full step flow

Mobile onboarding implements the **same seven steps as web**: welcome → profile (display name + avatar) → watch-country preference → optional Trakt import → follow suggestions → add watched Media Items → done. This replaces the lean welcome-only stub the rebuilt app shipped with, which deferred Trakt and social features to in-app discovery. We chose parity because the supporting screens and hooks already exist on mobile. The watched-Media-Items step also uses the shared discovery and Watch APIs. Keeping both clients' first-run flow identical avoids a per-platform product split.

## Why this supersedes part of ADR 0027

ADR 0027 deliberately deferred Trakt import and social to "v1.1+" to build mobile core-loop-first. That deferral is now stale — `apps/mobile/src/app/trakt-import.tsx`, `friends.tsx`, and the social hooks already shipped — so onboarding can use them today. ADR 0027 stays as the record of why they were once deferred; this ADR records that, for the onboarding flow, they no longer are.

## Consequences

- **Native dependency.** The profile step's avatar upload pulls in `expo-image-picker` (a config-plugin native module), requires an iOS photo-library permission string in `app.config.ts`, and forces an EAS rebuild before it runs on device. This is the one piece that is not pure JS and not trivially reversible. (Display-name-only was considered and rejected in favour of parity.)
- **Email verification stays a standalone `/verify-email` route on mobile**, unlike web (which folds it into the onboarding route per ADR 0004). Mobile's gate already works via the tabs layout + onboarding redirect, so it is not re-folded.
- Onboarding reuses existing mobile screens' logic rather than duplicating it: the Trakt step shares a panel with `/trakt-import`, the suggestions step reuses `UserRow` + `useFollowToggle`, and web's static `countries.ts` is copied into mobile for the country picker.
- The watched-Media-Items step runs after follow suggestions and uses the shared mixed discovery feed. Skipping a card writes nothing. Marking a movie watched adds one undated Watch. Marking a show watched uses the existing show-wide action, which adds an undated Watch for each aired episode and must surface partial batch results.
