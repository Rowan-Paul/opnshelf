# Featured Content

Issue: [#255](https://github.com/Rowan-Paul/opnshelf/issues/255)

Status: Implemented and verified locally; not released.

## Agreed behavior

- Each feature highlights a Media Item with an editorial “why now” message
  and an optional source link, rather than creating a standalone announcement.
- Everyone sees the same editorial selection: signed-out Web App visitors
  and signed-in Users on both the Web App and Mobile App. Country, My Services,
  and previously tracked titles do not filter the selection.
- Movies, shows, and seasons are eligible, including upcoming releases,
  returning seasons, newly released titles, and older titles worth revisiting.
- Selection is controlled by an admin, as requested in the issue.

## Placement and editorial access

Featured Content appears at the top of Discover's browse view on both clients,
above the existing sections. It is hidden while displaying search results.
Discover includes rediscovering already-tracked titles through these picks.

The operator's account is the sole initial admin. Management uses a protected
Web App editor; the Mobile App presents the published selection without
editorial controls.

## Active selection and navigation

- Up to five picks may be active, in manually chosen order.
- Each exact Media Item may have at most one active entry.
- Publication is immediate. The admin can edit or remove a published pick.
- Every pick requires an expiry date, defaulting to seven days. Scheduled
  publication is deferred.
- The main card opens the Media Item's existing detail page. A separately
  labelled optional link opens the exact trailer or source chosen by the admin.
  The existing automatic trailer selector does not choose this link.

## Cards and presentation

Use a manually scrollable horizontal row with no automatic rotation. Each
card uses the selected title's existing artwork, title, and season where
applicable, plus a required plain-text editorial message of up to 280
characters. Custom artwork and rich text are outside this design.

The optional source is one HTTPS link labelled “Watch trailer” or “Read
announcement”. Editorial copy must be spoiler-free and name the region when
announcing a region-specific release date. The region in the message does
not filter who sees the pick.

Hide the section when no picks are active. Initial loading uses card-shaped
skeletons; refetching retains already-loaded content under the repository's
loading-state rules.

## Expiry and reuse

Expired and manually removed picks remain inactive in the editor, available
to edit and republish. Show expiry as an exact date and time in the admin's
timezone. Editing an active pick preserves its expiry; republishing defaults
to seven days from now. Publishing a sixth active pick requires removing
another first. The one-active-entry-per-exact-Media-Item rule also applies
when republishing.

## Ownership and corrections

Featured Content belongs to Opnshelf and is stored by the service, independent
of the admin's personal public records. The admin's account authorizes editing;
publication creates no Review, Activity, or Bluesky Cross-post. See
[ADR 0043](../adr/0043-featured-content-is-service-owned.md).

Corrections are manual through the editor. Publication requires selecting an
existing catalog title; custom titles are outside scope. Temporary metadata
failure retains previously loaded card content. A confirmed missing title
hides that pick. The admin corrects or removes broken external source links.

## Completion boundary

No product questions remain open from the interview. The operator confirmed
the complete shared understanding and authorized implementation.
Schema and endpoint design, server-enforced admin identity configuration,
and editor components are implementation choices within this contract.

Reader behavior is shared across Web and Mobile. Editorial management is
deliberately Web-only. There is no standalone public announcement page,
scheduled publication, or personal record federation in this scope.

## Existing constraints

Both clients have Discover at `/search`. The current implementation has no
editorial feature model or product admin role. Existing trailer selection
prefers official trailers rather than selecting the newest trailer.

ADR 0008 covers TMDB-powered similarity; human editorial selection is a
separate capability. Any new public URLs must follow ADR 0023's client parity
rule. Public Web content follows ADR 0039's SSR behavior. TMDB cache freshness
under ADR 0041 cannot guarantee immediate access to a new announcement.

## Implementation and rollout

The public selection is served by `GET /featured`. Authenticated access discovery
uses `GET /featured/access`; the admin editor at `/admin/featured` uses protected
`/featured/manage` endpoints. Active and inactive editor lists use the shared
pagination contract. PostgreSQL transaction locks serialize editorial writes so
concurrent tabs cannot exceed five active picks or publish duplicate Media Items.

Set the non-secret backend variable `FEATURED_ADMIN_DID` to the operator's exact
account DID to enable editing. Missing configuration disables editing. Configure
each environment deliberately; a handle or PDS administrator credential does not
grant editorial access.

Apply migration `20261003130000_add_featured_content` through the approved release
process before deploying this API. Local verification uses a disposable PostgreSQL
database; no production or Staging migration or configuration change is included.

The Mobile App version is unchanged. This JavaScript-only feature uses the OTA
release route, after the API and migration are available, subject to operator
approval. Local simulator development builds are verification artifacts only.

The admin publishes immediately or saves an inactive pick for reuse. Public
clients refresh the selection and hide locally cached picks at expiry; Mobile
pull-to-refresh includes Featured Content. Public Web HTML includes the selection.
Catalog verification uses the shared TMDB cache and a 1.5-second public lookup
budget, falling back to saved title/artwork on temporary failure. Only a confirmed
404 hides a title; other upstream failures do not count as deletion. Publication
requires successful catalog verification. Source URLs are HTTPS-only and opened
separately from the internal Media Item link.

## Verification record

Verified locally on 2026-10-03 with Node.js 24 and pnpm 11.1.2.

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Passed across Web, Mobile, and Backend |
| `pnpm check` | Passed across Web, Mobile, and Backend |
| `pnpm --filter web run test --maxWorkers=2` | 388 passed; 1 existing performance test skipped |
| `pnpm --filter mobile run test` | 359 passed; 1 existing performance test skipped |
| `pnpm --filter backend run test --maxWorkers=2` | 1,101 passed; 2 opt-in local database tests skipped |
| `FEATURED_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55455/featured pnpm --filter backend run test src/featured/featured.integration.spec.ts` | Both passed against disposable local PostgreSQL, including concurrent publication limits |
| `pnpm --filter backend run build` | Passed |
| `pnpm generate:api` | Passed; reviewed generated OpenAPI and shared client changes |
| `pnpm --filter @opnshelf/api exec tsc --noEmit` | Passed |
| `pnpm prisma:generate` | Passed; generated the new model |
| `pnpm --filter backend run env:docs` | Passed; documented the admin DID variable |

The unrestricted parallel rerun timed out in three existing Web/Backend tests
while Xcode was compiling. All passed with two workers; no test timeout or
unrelated test implementation was changed.

Browser verification used a local fixture API with real Featured Content
controllers, service, and PostgreSQL persistence. Catalog and authentication were
fixtures. Checked Discover at `http://localhost:3255/search` at desktop and narrow
widths, signed-out access, hiding picks during search, media/season URLs, and
poster failure handling. The editor at `http://localhost:3255/admin/featured`
was exercised through publishing, editing, reordering, removal, republishing,
season selection, and access denial. Checked public HTML contains the selection.

UI screenshots are attached to the pull request rather than stored in Git.

Native visual verification used iOS 27 on a dedicated iPhone 18 Pro simulator,
route `/search`, with the same local fixture API. Checked card sizing and copy,
manual horizontal scrolling, opening the selected Inception trailer in the
browser, and hiding the section when searching. The local arm64 Debug Xcode build
completed successfully. Its unsigned configuration caused keychain/session
warnings, so this check used guest browsing; authenticated native sessions and
Android were not visually exercised. Screenshot-based coordinate interactions
worked after the simulator accessibility helper timed out.

Changed source areas: `backend/src/featured`, Prisma schema and migration, backend
module/environment registration, shared API helpers and generated contracts,
both Discover routes and featured components, Web editor route, and product/ADR
documentation. No lexicons, PDS writes, or Mobile app version changes are needed.
