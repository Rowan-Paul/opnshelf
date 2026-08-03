# 0021 - Staging shares the production PDS but never shares Tab

## Status

Accepted

## Context

Issue #202 asks for a test environment for web and mobile, so changes can be
checked on a real URL before the public sees them. Two reasons drive it: driving
AI workflows against a deployed URL is easier than remoting into a device, and a
gate before production makes releases versionable.

The stack forces most of the decisions:

- The backend writes through. `library.service.ts:125` puts the record on the
  PDS, then `:137` writes Postgres directly. Tab is the catch-up path, not the
  write path.
- Tab has no consumer identity. `Tap.channel()` (`@atproto/tap` `client.ts:42`)
  opens `wss://<tab>/channel` with no channel or consumer id, authed by admin
  password, and acks by bare event id. One queue, one cursor.
- `client_id` for OAuth is derived from `backendUrl`
  (`auth.service.ts:1450`), so any backend with a public HTTPS origin serves its
  own client metadata.
- The session cookie domain is the hostname of `FRONTEND_URL`
  (`auth.controller.ts:83-97`), and is only set when `NODE_ENV=production`.
- The PDS already lives in its own Railway project (ADR 0019).

## Decision

**Staging shares the production PDS.** Test writes are real, public records in a
real repo, they federate, and per ADR 0015 a review posted on staging becomes a
real Bluesky post. This is accepted, with one mitigation: staging is used with a
separate account from the production one.

**Staging gets its own Tab instance.** This is not a cost trade-off. Two
backends against one Tab are competing consumers on a shared cursor: events
staging acks are gone, and the production index silently loses those records with
no error anywhere. Cost is not a reason to skip it, because
`registerExistingUsers()` registers only the repos of users in its own Postgres,
and staging's Postgres holds one user. Production's Tab is expensive because it
tracks every user's repo; staging's tracks one.

**Staging is a Railway environment, not a second project.** The `opnshelf`
project gains a `staging` environment, which duplicates Server, Web, Postgres and
tap with their own variables. The stale `tranquil-pds` service in that project is
not carried into staging. The staging backend reaches the production PDS in the
`opnshelf-pds` project over its public URL, since private networking does not
cross projects.

**`develop` is the working branch; `main` is release-only.** The staging
environment deploys from `develop`, production keeps deploying from `main`. The
previous convention was to commit straight to `main`, and that convention is now
wrong: a push to `main` deploys to production and skips staging.

**Domains nest, they do not sit side by side.** Staging web is
`staging.opnshelf.xyz` and the staging API is `api.staging.opnshelf.xyz`. The
cookie domain is taken from `FRONTEND_URL`'s hostname, so `staging.opnshelf.xyz`
covers `api.staging.opnshelf.xyz` while a sibling `api-staging.opnshelf.xyz`
would never receive the session cookie. Staging runs `NODE_ENV=production` or the
cookie is neither secure nor domain-scoped.

**One mobile app, not two.** The staging build keeps
`com.rowanpaul.opnshelf` and the `opnshelf` scheme, and is installed through EAS
internal distribution on the existing `preview` channel. Installing it replaces
the production app until reinstalled from TestFlight. The alternative - a second
bundle id - was rejected because it drags in a second provisioning profile, a
second OAuth redirect scheme, and separate app groups for the widgets in ADR 0017
and ADR 0018.

**Store tracks carry production builds only.** The full mapping:

| Environment | API | Build profile | Update channel | How it reaches a device |
|---|---|---|---|---|
| Local | `127.0.0.1:3001` | `development` | `development` | Dev client, never distributed |
| Staging | `api.staging.opnshelf.xyz` | `preview` | `preview` | EAS internal distribution: sideloaded APK on Android, ad-hoc on iOS. No store track. |
| Production | `api.opnshelf.xyz` | `production` | `production` | Play production at 10%, then ramped; TestFlight, then App Store |

No Play track and no TestFlight build ever carries a staging build. Two reasons,
both structural rather than preference:

1. There is one bundle id, so every store track is a stage of the same app
   record and any build on a track can be promoted to production. A staging
   build on a track is one careless promotion away from being public, and its
   `channel: preview` would then pull staging OTA updates onto public installs.
2. `autoIncrement` is set only on the `production` profile while
   `appVersionSource` is `remote`, so repeat `preview` builds reuse a version
   code. Play rejects a duplicate. Sideloading does not care.

Within production, `eas.json` submits Android to `track: production` with
`releaseStatus: inProgress` and `rollout: 0.1`, so a release reaches 10% of
users and is ramped or halted from the console. Google's track ids do not match
the Play Console labels, so for the avoidance of a costly mistake:

| `eas.json` track | Play Console tier | Audience |
|---|---|---|
| `internal` | Internal testing | Named testers, no review |
| `alpha` | Closed testing | Invited testers or lists |
| `beta` | Open testing | Anyone with the link |
| `production` | Production | Everyone on the store |

The earlier decision was `track: beta`, open testing, promoted to production
from the console. That is now rejected: it costs two reviews and two waits, and
open testing earns its keep only with a self-selected tester pool giving
feedback, which this project does not have. A staged rollout on production gives
the same protection - real users, a small fraction of them, one click to halt -
for one review. Staging on `develop` and TestFlight internal remain the rings
before any of it.

On iOS the equivalent of open testing is **TestFlight external with a public
link**, not TestFlight as a whole. TestFlight has two tiers and they are not
interchangeable:

| Tier | Who | Limit | Review |
|---|---|---|---|
| TestFlight internal | App Store Connect team members | 100 | None |
| TestFlight external | Anyone, by email or public link | 10,000 | Beta App Review, first build then each build |
| App Store | Everyone | - | Full App Review |

Three differences from Android worth planning around. `eas submit` uploads to
App Store Connect and can assign TestFlight groups through the `groups` submit
field, but it never submits for App Review - that click stays in the console,
where a `track: production` Android submit publishes on its own once reviewed.
Apple has no promotion ladder: every TestFlight build is a direct candidate for
App Store submission from the same list, so there is no equivalent of promoting
between tracks. And Apple's answer to a staged rollout is **phased release**, a
fixed seven-day automatic ramp (1, 2, 5, 10, 20, 50, 100%) chosen at submission
and pausable, rather than a percentage you set yourself.

TestFlight internal is worth using on iOS even though Android's internal testing
is not, because it is free, needs no review, and gives a check of the production
build against the production API before anything external sees it. An Android
AAB cannot be sideloaded, so it has no cheap equivalent.

`runtimeVersion` uses the `appVersion` policy, so staging and production builds
share runtime `1.0.0`. The channel is the only thing separating their OTA
updates - an update published to `production` reaches every production-channel
build on that runtime.

**Staging holds the production PDS admin credentials.** Without them, signup and
account deletion are the only two flows staging can never test, and they are
among the most fragile. The accepted risk is that a staging bug can create or
delete real accounts on `opnshelf.social`.

**Staging sends no analytics.** `EXPO_PUBLIC_POSTHOG_KEY` and
`VITE_POSTHOG_KEY` are left unset so test traffic does not pollute product data.

## Consequences

- Every push to `develop` publishes real, public records from the staging
  account. There is no such thing as a throwaway write.
- Deleting the staging account does not undo anything: the DID and the
  tombstones stay.
- Staging's Postgres starts empty and fills from the staging account's own repo
  as its Tab backfills. Production data never appears on staging.
- A wrong `TAB_URL` on staging - pointing at production's Tab - drops records
  from the production index with no visible error. Treat that variable as
  load-bearing.
- Resource use in the `opnshelf` project roughly doubles: a second Postgres, a
  second Tab with its own volume, plus Server and Web.
- Turnstile is domain-scoped, so the staging hostname must be added to the
  existing widget or signup captcha fails on staging.
- Cloudflare's universal certificate does not cover a third-level name, so the
  staging DNS records are DNS-only and Railway issues the certificates.
- Analytics-driven behaviour cannot be tested on staging, because analytics are
  off there.
- Installing the staging APK replaces the production app, and Play will not
  offer the production app back until it is reinstalled from a track.
- A `preview` build cannot be submitted to a store without first giving the
  `preview` profile its own `autoIncrement`, which is a deliberate speed bump.
- Every store release waits on Google review, so turnaround is hours or days.
  Releases that leave `version` alone skip that wait by going out as an OTA
  update instead, which `.github/workflows/release.yml` publishes on its own.
- That OTA reaches users minutes after a merge to `main`, with no one looking at
  it on a device first. Staging on `develop` is the only gate in front of it, so
  layout changes in particular want checking on the `preview` channel before the
  merge, not after. `.github/workflows/staging.yml` keeps that channel current
  on every push, so the check costs nothing but opening the app.
- EAS Build allows 15 builds per platform per month on the free plan. A version
  bump now costs two of them, a preview build off `develop` and a production
  build off `main`, which caps releases that change the version at roughly seven
  a month. Updates are unlimited, so releases that leave the version alone are
  free.
- A submitted Android build goes live to real users at 10% once reviewed, with
  no further gate. Ramping to 100% and halting a bad release are both manual
  console steps, so someone has to watch it.

## Alternatives considered

**A separate staging PDS.** Rejected. It means a second Railway project, second
Postgres, second SMTP path, and DIDs that never federate to the public relay,
re-entering the firehose-cursor and hostname-reuse problems already paid for
once.

**Staging on `main`, production on a git tag.** Rejected in favour of a
`develop` branch. A tag gate gives real versions but ends push-to-deploy for
production.

**No Tab on staging.** Rejected. Safe and free, but staging's Postgres would
never see anything from the staging account's existing repo, so the account looks
permanently brand new.

**Preview deploys instead of an environment.** Considered, since writes are
write-through and much could be tested locally. Rejected because the stated need
is a stable URL for AI workflows and a release gate, and a per-PR URL gives
neither.
