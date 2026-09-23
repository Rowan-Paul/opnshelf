# Mobile performance audit — 2026-09-23

Base: `origin/develop` at `9462f0f0`. Target: iPhone 18 Pro simulator, iOS 27, Expo development build. This audit covers all 40 non-layout route files in `apps/mobile/src/app`: 33 opened and visually checked in the simulator, 7 inspected in source. Initial public read measurements used the production API. Before any test-account sign-in, the development server was restarted with `EXPO_PUBLIC_API_URL=https://api.staging.opnshelf.xyz` and `EXPO_PUBLIC_SITE_URL=https://staging.opnshelf.xyz`, and the simulator app was reloaded. The test account was then signed in to staging. The initial signed-in audit used navigation and reads only. The operator subsequently authorized creation of a Review and Circle for the two populated detail routes.

## Tools and limits

There is no native Lighthouse score. React Native DevTools has a React commit profiler, Expo Network, and a Performance timeline; Expo Atlas inspects bundle composition, and native Instruments measures device threads. Expo's production monitoring option is EAS Observe. In this installed development build, the DevTools Performance and Expo Network panels report that multiple React Native hosts are registered, so neither can record. The React commit profiler works, but development-mode commit times are not production launch timings. Expo Atlas was unavailable because `expo-atlas` is not installed; its automatic offline installation failed. Normal production iOS and Android exports and a temporary API timing probe supplied the measurements below. The probe was removed after testing.

## Measured findings and changes

| Area | Before | After | Evidence |
| --- | --- | --- | --- |
| Production iOS export | 56 assets, 7,611,274 asset bytes; 8,074,355-byte Hermes bundle | 32 assets, 2,054,110 asset bytes; 8,056,443-byte Hermes bundle after all code changes | Importing only the eight used font weights removed 24 unused assets. Assets plus Hermes fell from 15,685,629 to 10,110,553 bytes (35.54%). This measures export size, not cold-start time. |
| Production Android export | No before export captured | 36 assets, 3,010,140 asset bytes; 8,301,814-byte Hermes bundle after all code changes | The Android production bundle exported successfully. This is an artifact size check, not a before/after speed measurement. |
| Guest cold show deep link | Three Discover catalogue GETs ran behind the show route, alongside show detail and its sections | No Discover GETs on the same reload; the three GETs ran when Discover was subsequently opened | Temporary development-only API probe on `/shows/1399/game-of-thrones`, then `/search`. The show detail GET took 1,921 ms before and 523 ms after in separate runs, but network variance prevents attributing that timing difference to the code change. The reliable result is three fewer competing requests. |
| Signed-in Discover show progress | Five `/shows/progress` requests across separately scoped rails in one navigation | One shared rail scope yielded three batched requests on a fresh reload and two on a warm navigation as data arrived | Staging simulator request-path probe, removed afterward. Batches have a 50-show cap; this is a request-count improvement, not a production frame-time measurement. |
| Home previews | Up Next asked for 20 entries to show 4; Shelf asked for 24 to show 10 | Requests now ask for 4 and 10 | Query parameters in the Home hooks. |
| Profile previews | Self profile asked for 24 Shelf and 20 Up Next entries to show 10 and 4; public overview asked for 24 of each Shelf type to show 10 | Requests now match the visible counts | Query parameters in the profile hooks. Full paginated pages retain their page sizes. |
| Provider logo | Original TMDB image for a 40 px chip | TMDB `w92` image, matching Web | Sample public logo: 10,813 bytes at original, 2,436 bytes at `w92`. Country-dependent provider reads also wait for the viewer's settings to avoid an initial US read followed by the preferred country. |
| Compact thumbnails | Calendar and compact Home activity rows requested `w342` posters; activity fallback backdrops requested `w1280` | Posters request `w185`; fallback backdrops request `w780` | Calendar posters display at 56 pt wide (about 168 px at 3×) and Home activity posters at 44 pt (about 132 px). Calendar was visually checked after the change. The test account's empty Activity Feed did not provide an activity-row image for a live comparison. |
| Settings categories | Profile, Help, and Account mounted settings, Trakt import, and publication queries they did not display | Each query runs only for the category using it | Query `enabled` conditions; no account behavior changed. |

Signed-in staging observations: Home loaded its dashboard, Social showed the empty-feed suggestions state, self Profile loaded previews, and Shelf, Up Next, Lists, Calendar, Settings, social discovery, public profile, and media detail routes rendered. A temporary development-only probe logged paths/status/duration without bodies, query strings, or credentials. On an already running simulator, Profile started seven reads (125–267 ms); Lists and Calendar each started one route-specific read (850 ms and 463 ms in those runs). The signed-in show detail started twelve section and account-related reads, and the movie detail thirteen. These are single-run development timings, not comparable production page-load benchmarks. The large Trakt import history rendered, with its issues fetched only on that route. Settings index and Help started no category reads. After explicit authorization, a temporary staging-only development route used the signed-in app session to create the `Mobile performance test` Circle and a clearly labeled test Review of *The Matrix*. The Review was created with blog mirroring and Bluesky Cross-post disabled. Its `xyz.opnshelf.review` record was verified on the public PDS at `at://rowanpaul.opnshelf.social/xyz.opnshelf.review/3mw6qjwm7kc2r`. The Circle is local staging data. Both detail routes loaded in the simulator; the Circle correctly showed zero members. The temporary creation route was removed after verification.

## Route-by-route review

“Simulator” means the route was opened and visually checked on the iOS simulator. “Source” means its query, pagination, and rendering path was inspected without a live route check.

| Route file under `src/app` | Review | Finding |
| --- | --- | --- |
| `(tabs)/index.tsx` | Simulator | Home previews now request their visible counts; the signed-in dashboard rendered. Production launch timing remains to measure. |
| `(tabs)/search.tsx` | Simulator | Discover loads on focus; a cold detail deep link no longer starts its background catalogue reads. Show progress is batched across rails. Search results use paginated FlashLists. |
| `(tabs)/social.tsx` | Simulator | The account showed the empty-feed suggestions state. Activity Feed uses an infinite query and FlashList; a populated feed was unavailable without follow writes. |
| `(tabs)/profile.tsx` | Simulator | Self-profile preview requests now match visible Shelf and Up Next counts. |
| `calendar.tsx` | Simulator | Week and month queries use bounded date windows and retain prior data while changing range. |
| `devices.tsx` | Simulator | One account-device list; no per-row data requests found. |
| `edit-profile.tsx` | Simulator | Form screen; no unbounded list or repeated catalogue request found. |
| `list/[handle]/[slug].tsx` | Simulator | Public list uses FlashList and the shared profile-list query. |
| `lists/index.tsx` | Simulator | List overview uses FlashList. |
| `lists/[slug].tsx` | Simulator | List detail uses FlashList; sorting and search are local to the opened list. |
| `movies/[id]/[name]/index.tsx` | Simulator | Detail loaded; related sections run separate cached queries. Provider logo image size was reduced. |
| `movies/[id]/[name]/credits.tsx` | Simulator | Full credits are shown in horizontal FlatLists; the parent page reuses the movie-detail query for its title. |
| `shows/[id]/[name]/index.tsx` | Simulator | Cold deep link was probed; Discover background requests were removed. Provider logo and country changes apply here too. |
| `shows/[id]/[name]/credits.tsx` | Simulator | Full credits use horizontal FlatLists and reuse the show-detail query for the title. |
| `shows/[id]/[name]/seasons/[seasonNumber]/index.tsx` | Simulator | Episode rows use a bounded FlatList window; one filtered Up Next query identifies the next episode. |
| `shows/[id]/[name]/seasons/[seasonNumber]/episodes/[episodeNumber]/index.tsx` | Simulator | Finite episode detail; separate cached show and episode reads. |
| `people/[id]/[name].tsx` | Simulator | Person and paginated filmography loaded; grid uses FlashList. |
| `profile/[handle].tsx` | Simulator | Only the active profile tab mounts; its shared scroll container follows ADR 0033. |
| `profile/[handle]/connections.tsx` | Simulator | Deep-link wrapper for the profile Connections tab. |
| `profile/[handle]/reviews.tsx` | Simulator | Deep-link wrapper for the profile Reviews tab. |
| `profile/[handle]/shelf.tsx` | Simulator | Deep-link wrapper for the profile Shelf tab. |
| `profile/[handle]/up-next.tsx` | Simulator | Deep-link wrapper for the profile Up Next tab. |
| `reviews/[handle]/[rkey].tsx` | Simulator | The new Review loaded its title, author, film card, and full body; no unbounded collection. |
| `settings.tsx` | Simulator | Index is a short catalogue; category queries are now gated to their pages. |
| `settings/preferences.tsx` | Simulator | Shared settings category; reads settings only. |
| `settings/connections.tsx` | Simulator | Shared category; reads settings, publications, and Trakt import here. |
| `settings/account.tsx` | Simulator | Shared category; account deletion status is also monitored by the app-wide gate. |
| `settings/help.tsx` | Simulator | Shared category; unrelated settings, publication, and Trakt queries are disabled. |
| `social/find.tsx` | Simulator | People search paginates as the shared scroll container reaches the end. |
| `social/circles/index.tsx` | Simulator | Circle overview is a short list. |
| `social/circles/[circleId].tsx` | Simulator | The new Circle loaded its name and zero-member state; member selection paginates through the shared scroll container. |
| `trakt-import.tsx` | Simulator | Import issues use a paginated query with end-reached loading. |
| `atstore-review.tsx` | Simulator | Single prompt/form route; no collection load. |
| `login.tsx` | Source | Handle suggestions are tied to the form; no background catalogue request. |
| `signup.tsx` | Source | Form route; no list load. |
| `signup-handle.tsx` | Source | Form route; no list load. |
| `verify-email.tsx` | Source | Verification gate; no collection load. |
| `onboarding.tsx` | Source | Fixed-size discovery deck and step-specific reads; no unbounded list found. |
| `auth/complete.tsx` | Source | Authentication callback route; no page collection. |
| `+not-found.tsx` | Source | Static fallback. |

## Remaining measurements

- Measure cold launch, time to first render, frame stalls, and route-interactive times in a production-like build. The development build and its API probe supplied request counts and single-run durations, not trustworthy production startup timings. A populated Activity Feed, Circle detail, and Review detail also need suitable existing staging data for live checks.
- In a production-like build, compare cold launch, time to first render, and route-interactive times across releases. EAS Observe can provide real-device route metrics if the project chooses to add its native library and ship a new store build.
- The `useRefreshActiveQueries` helper refetches every active query on a detail-screen pull gesture. This is a plausible cross-screen overfetch, but changing its scope needs a signed-in trace and a complete list of the visible screen's child queries so refresh does not miss data.
- The Library endpoint returns the full collection even when self Profile displays ten items. That API contract needs pagination before its payload can be reduced safely.

No deploy, store build, or OTA update was run.
