# ADR 0038: Android releases roll out to everyone

Status: Accepted and implemented; supersedes the Android rollout percentage in ADR 0021.

ADR 0021 sends each Android production release to 10% of eligible users and
requires an operator to return to Play Console to finish the rollout. That
manual gate is no longer useful for the project's release process. Staging and
the production build already provide the pre-release checks, while leaving an
approved production release at 10% makes completion easy to forget.

## Decision

Android submissions to the Play production track are completed releases. EAS
Submit uses `releaseStatus: "completed"` with no `rollout` value, which is
Google Play's representation of availability to every eligible user. A rollout
fraction of `1` is not used: Google's Publishing API only accepts
`userFraction` values strictly between zero and one for an `inProgress`
release.

This changes only the default for future Android submissions. It does not alter
the separation between preview and production builds, the requirement to test
on Staging, Google Play review, or the operator's ability to halt a release in
Play Console.

iOS remains different. EAS Submit uploads a build to App Store Connect, and an
operator still selects the build and submits it for App Review. App Store
phased release remains a per-release choice in App Store Connect.

## Consequences

- Once Google approves an Android production submission, every eligible user
  can receive it without a second rollout action.
- There is no percentage ramp to watch or advance after approval.
- Halting a bad release remains possible, but fewer users are shielded while an
  issue is discovered after publication. Staging and store-build verification
  therefore remain the release gates.

## Alternatives rejected

- **Keep the 10% staged rollout.** It limits initial exposure, but it also
  creates a manual completion step that this project no longer wants.
- **Set `rollout: 1` on an `inProgress` release.** EAS accepts numbers up to one
  in its configuration schema, but Google Play's Publishing API requires a
  staged `userFraction` to be greater than zero and less than one. A completed
  release is the native representation of 100% availability.
