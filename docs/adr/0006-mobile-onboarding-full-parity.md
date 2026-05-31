# ADR 0006: Mobile onboarding mirrors web's full step flow

Mobile onboarding implements the **same six steps as web** — welcome → profile (display name + avatar) → watch-country preference → optional Trakt import → follow suggestions → done — rather than the lean welcome-only stub the rebuilt app shipped with (which punted Trakt and social to in-app discovery). We chose parity because the supporting screens and hooks already exist on mobile (`useTraktImport`, `TraktImportBanner`, `UserRow`, `useFollowToggle`, `/social/suggestions`), so the cold-start activation wins web gets from importing history and following people at first run are cheap to reproduce, and keeping the two clients' first-run UX identical avoids a per-platform product split.

## Why this supersedes part of ADR 0002

ADR 0002 deliberately deferred Trakt import and social to "v1.1+" to build mobile core-loop-first. That deferral is now stale — `apps/mobile/src/app/trakt-import.tsx`, `friends.tsx`, and the social hooks already shipped — so onboarding can use them today. ADR 0002 stays as the record of why they were once deferred; this ADR records that, for the onboarding flow, they no longer are.

## Consequences

- **Native dependency.** The profile step's avatar upload pulls in `expo-image-picker` (a config-plugin native module), requires an iOS photo-library permission string in `app.config.ts`, and forces an EAS rebuild before it runs on device. This is the one piece that is not pure JS and not trivially reversible. (Display-name-only was considered and rejected in favour of parity.)
- **Email verification stays a standalone `/verify-email` route on mobile**, unlike web (which folds it into the onboarding route per ADR 0004). Mobile's gate already works via the tabs layout + onboarding redirect, so it is not re-folded.
- Onboarding reuses existing mobile screens' logic rather than duplicating it: the Trakt step shares a panel with `/trakt-import`, the suggestions step reuses `UserRow` + `useFollowToggle`, and web's static `countries.ts` is copied into mobile for the country picker.
