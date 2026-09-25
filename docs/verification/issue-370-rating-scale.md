# Rating scale audit — issue #370

## Display contract

All numeric media ratings use the stored 1–10 scale and an explicit `/10`
denominator. The picker and personal-rating displays retain five stars with
half-star steps: each half-star is one point. This presentation was explicitly
chosen by the operator. Read-only stars include the numeric score, and screen
readers announce the score out of ten.

AT Store reviews are a separate 1–5 assessment of Opnshelf itself, as defined in
CONTEXT.md. Their controls and API contract remain unchanged.

## Audit coverage

Searches covered Web and Mobile source, backend output and storage, the shared
API client, lexicons, native widget/module sources, and every caller of both
StarRating components. Checked rating/vote-average fields, star icons, conversion
helpers, division/multiplication, formatted numbers, labels, and accessibility
text. This is a source audit plus focused runtime checks, not a claim that every
route was visited or every account state exercised.

| Surface | Web | Mobile |
| --- | --- | --- |
| Suggestions, Discover/search, filmography, lists and other poster cards | Shared MediaCard no longer halves TMDB/community scores; now appends `/10`. Personal stars include score/10. | Shared MediaCard already preserved the scale; now appends `/10`. Filmography cards do not display a score. |
| Command-palette search | Movie/show scores now append `/10`; missing scores remain N/A. | No equivalent command palette. Discover uses MediaCard. |
| Movie, show, season and episode headers | Already show aggregate scores out of ten. | Shared DetailHero now appends `/10`. |
| Season/episode detail metadata | Already explicitly out of ten. | Already explicitly out of ten. |
| Episode rows | Web EpisodeRow does not display a score. | EpisodeCard now appends `/10`. |
| Onboarding | WatchedSwipeStep does not display a score. | Watched-media swipe cards now append `/10`. |
| Standalone rating editor and rating action | RatingDialog and MediaActionsBar now display the stored score out of ten. | RatingSheet and RatingButton now display the stored score out of ten. |
| Combined rate/review editor | ReviewDialog now labels the personal score out of ten. | ReviewEditorSheet now labels the personal score out of ten. |
| Community reviews and profile reviews/overview | Shared StarRating, including ReviewAuthorRating, now shows and announces the score out of ten. | Shared StarRating, including ProfileReviewRating, now shows and announces the score out of ten. |
| Social activity and quick rating actions | ActivityCard/MiniActivityCard inherit corrected StarRating; rating dialogs inherit the same change. | ActivityCard/ActivityRow inherit corrected StarRating; MediaActionBar and card quick actions use corrected RatingSheet. |
| Standalone long-form review pages | No numeric rating display. | No numeric rating display. |
| Home-screen widgets, notification/email output | No separate media rating display found. | Widgets show Watch activity, not numeric ratings. |

## Data and boundaries

- SetRatingDto and the xyz.opnshelf.rating lexicon accept integer scores 1–10.
- RatingsService stores/submits/indexes the original score; single and batch
  aggregate endpoints return the arithmetic average without a scale conversion.
- Review-author joins and social feed mapping retain the original score.
- Discovery's rating threshold is already expressed on the ten-point scale.
- TMDB fields pass through the backend and client mapping without halving.
- The lexicon/API description that maps 1–10 to 0.5–5 stars is still accurate for
  the retained half-star graphic. It does not define the displayed numeric scale.
- No data migration, API regeneration, native dependency or version change is
  needed. Mobile is eligible for an OTA update; publication requires approval.

## Regression checks

- Web card tests reproduce the original TMDB and community-score halving.
- Both shared star components test personal display and accessibility at 1, 5,
  8 and 10, and every half-star choice emits its original 1–10 integer.
- Web RatingDialog checks its visible denominator, accessible current value,
  episode-rating mutation payload, and separate clear action.
- Mobile RatingSheet checks its visible score, rating callback, and clear action.
- Existing Web community-review/profile-rating tests now assert the ten-point
  accessible label.

## Runtime verification

Browser before/after evidence uses actual shared components in a temporary local
fixture, with API hooks stubbed to avoid public account writes. Fixture values
are 7.3 for the aggregate and 9 for the personal rating. The fixture is removed
before handoff. See the pull request for screenshots and final gate results.

On iPhone 18 Pro / iOS 27.0, the updated `/movies/920/cars` header displayed
`7.1/10`. A temporary `/rating-audit` route rendered the real RatingSheet and
StarRating components with local state: the same four-and-a-half stars changed
from `4.5 / 5` to `9/10`; tapping the first and last half-star produced `1/10`
and `10/10`. The accessibility tree exposed all ten choices on that scale.
Android uses the same changed components but was not driven because its device
was reserved by another session.

Local gates: `pnpm typecheck`, `pnpm check`, `pnpm --filter web run test`
(335 passed, one pre-existing skip), and `pnpm --filter mobile run test`
(318 passed, one pre-existing skip). Backend/API gates are not applicable:
those sources and contracts were audited but not modified.
