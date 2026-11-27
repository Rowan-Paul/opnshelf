Opnshelf is a personal media tracker: people log what they watch, rate and review it, and see what others are watching. The interface is quiet slate with one warm signal, Screen Amber, which always means "yours" or "do this": a watched title, a filled star, the primary action.

## Voice and copy

- Write in sentence case everywhere: "Add to shelf", "Mark remaining watched", "Give your review a title". No title case, no all caps.
- Address the person as "you" and "your": "Could not publish your review. Try again."
- Name the action on the control: "Add to shelf" becomes "Remove from shelf" once it is done. Never "OK" or "Submit".
- Errors say what failed and what to do next in two short sentences: "Couldn't update the Watch date. Please try again." No apology, no exclamation mark.
- Empty states are one plain sentence: "No notes yet."
- Capitalise product nouns when they name the concept: Shelf, Watch, Rating, Review, List, Up Next, Release Notes. A Rating is the 1 to 10 score; a Review is the long-form text. Do not use one word for the other.
- Say "Streaming Service", not provider, platform or channel. Say "Up Next", not continue watching or queue.
- No emoji in interface copy. Icons carry that job.
- Numbers are plain and tabular: "8.1/10", "S2E4", "3 watches logged". Separate meta with a bullet: "2024 • 8.1/10 • 2h 46m".

## Color

- Build every surface from the semantic tokens, never from the `slate-*` or `accent-*` steps directly. `background` is the canvas, `background-elevated` is anything raised, `background-subtle` is a quiet fill.
- Set text in `foreground`. Use `foreground-muted` for secondary lines and meta. `foreground-subtle` has the same value and marks the least important text: placeholders, footers, captions.
- Spend `accent` sparingly and as a fill: the primary button, the watched pill, filled stars, the progress bar, the active nav underline. Put `accent-foreground` on it, in both themes.
- Set amber text in `accent-text`, never in `accent`: links, "View all", accent badges, active tabs. In light it is a deep amber that passes on every surface; in dark it is the accent itself. Hover is `accent-text-hover`.
- Stars, the progress bar and small decorative icons stay `accent`.
- Hover and focus fills on menus, selects and ghost or outline buttons are `background-subtle`, never amber.
- `destructive` is for error text and icons. A filled destructive button uses `destructive-solid` with white, in both themes.
- `success`, `warning` and `destructive` always sit beside a word or an icon. Success and destructive differ by hue alone.
- Both themes ship. Dark is not an inversion: the accent lightens to `accent-400` and the washes (`accent-subtle`, `accent-muted`) become translucent amber.
- On posters and backdrops, controls leave the token system: an unselected action is black at 70% with white, a remove button is black at 55%, and a backdrop title sits on a black gradient from 80%.

## Type

- One family, Timeless Sans, for everything. `--font-sans` and `--font-display` are the same face; display styles differ by weight and tracking only.
- Regular is weight 420. Use 500 for controls and nav, 600 for titles and badges, 700 for display and counts.
- Headings use `text-display-1` to `text-display-3` with their negative tracking. On Mobile the same three names step down to 34, 28 and 20px.
- Web body is 15px on a 1.5 line. Mobile body is 16px on 24.
- Use tabular numerals wherever digits line up or change: watch counts, progress text.
- Balance heading line breaks (`text-wrap: balance`).
- In React Native each weight is its own registered family. Ask for a weight through the `Text` primitive's `font-medium`, `font-semibold` or `font-bold`, never through `fontWeight`.

## Shape and depth

- Radii are generous and few: `radius-md` for Web controls, `radius-lg` for cards and posters and for every Mobile button and field, `radius-full` for badges, pills and round poster actions.
- Borders do the structural work. A resting card is `background-elevated` with a 1px `border` and `shadow-sm`. On hover it gains `shadow-md` and `border-strong`.
- Shadows are soft slate in light and black in dark. Do not add colored glows or gradients. The one gradient in the product is the black scrim on a backdrop.
- Sticky headers use glass: the elevated surface at 80% with a 12px blur.

## Layout

- Content sits in a 1400px container with gutters of `space-2` on phones, `space-6` from 640px and `space-8` from 1024px.
- Posters are 2:3, backdrops 16:9. Poster grids run two columns on phones up to six on wide screens.
- Web and Mobile show the same feature the same way. A change to one client is made on the other.
- Touch targets on posters are 36px on phones and tighten to 28px from 640px.

## Motion

- Controls change over 150ms ease. Cards and posters take 200ms.
- Content enters with a short rise: 8px and fade over 300ms on `cubic-bezier(0.16, 1, 0.3, 1)`. Lists stagger their first six children by 50ms.
- Popovers scale in from 96% over 200ms on the same curve.
- An interactive card lifts 2px on hover; a poster image scales to 105% over 300ms.
- A deep-linked review flashes an accent wash for 2s, once.
- Motion never loops, except a loading spinner and the skeleton pulse.

## States

- Focus is an opaque `ring`: a 2px outline with a 2px offset on buttons, a 3px ring on Select and Switch, and 2px on text inputs (a `ring` border plus 1px) with an `accent-subtle` halo outside it. The halo is decoration; never rely on it or on `accent` alone for focus.
- Disabled buttons drop to 60% opacity on both clients, except primary: fading amber kills its label contrast, so a disabled primary becomes a `background-subtle` fill with a `border` and `muted-foreground` label. A primary that is disabled only while its own request runs sets `aria-busy` and keeps its fill.
- Loading keeps the control's size: a spinner replaces the label without changing its width. Images load behind a `background-strong` pulse.
- A failed list is a ContentState with a destructive warning icon and `role="alert"`.

## Using the components

- Load `tokens.css`, then `components/bundle.css`, then React 18 and `components/bundle.js`. Components are on `window.Opnshelf`.
- Set `data-theme="light"` or `data-theme="dark"` on the root element. The `dark:` styles follow it.
- Icons are on `Opnshelf.icons`: AlertTriangle, Check, ChevronDown, Clock, ListPlus, MoreHorizontal, Play, Plus, Search, Settings, Star, StickyNote, Trash2, X.
- Overlays (Dialog, DropdownMenu, Select, Popover, Tooltip) are compound: compose the parts named in each component's guidelines.
- For plain markup use the classes `card`, `card-interactive`, `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `input`, `badge`, `badge-subtle`, `badge-accent`, `nav-link`, `empty-state` and `glass`.

## Iconography

- Icons are Lucide: `lucide-react` on Web, `lucide-react-native` on Mobile. Stroke 2, round caps and joins, no fills except stars and the play glyph.
- Default size is 16px inside controls, 12px in meta lines, 20px in poster fallbacks, 40px in content states.
- Icons take the color of their text. On an accent fill they take `accent-foreground`.
- The five Mobile tab icons under Icons are Lucide glyphs exported as files for the native tab bar.
- Third-party marks (Apple, Google, Trakt, Bluesky, the store badges) keep their owners' artwork and colors.

## The mark

- Use the lockup when the name must be explicit, the standalone mark for favicons, compact navigation and avatars, and the app-icon treatment for launchers.
- Keep clear space around the mark equal to the height of its amber tile.
- On dark surfaces the shelf shape is Paper (`slate-50`); the tile stays Screen Amber (`accent-600`).
- Do not recolor the tile, add gradients or shadows, rotate the mark, or place artwork inside its open edge.
- Below 24px use the standalone mark, and drop the tile only if it no longer reproduces.
- The mark avoids play buttons, film reels, clapperboards and stars. Do not add them beside it.

## Not synced

- Web variables skipped: `--shadow-color` (folded into the shadow values) and the `--color-*` Tailwind theme mappings, which repeat the tokens above.
- Spacing has no variables in the source. The steps listed are the Tailwind scale values the primitives use.
- Components are the real Web components, built into one bundle that runs on React 18 (the app runs React 19). `MediaCard` uses a plain anchor in place of the router link and a no-op in place of analytics. Card, Badge, NavLink and TextField are CSS classes, shown as plain markup.
- The stylesheet is the Web app's Tailwind build. Its dark variant keys on `data-theme="dark"` here; the app keys on a `.dark` class.
- Mobile components are React Native and cannot run in a preview. The Mobile button is a static rendition.
- Not included: Command and Toast on Web; BottomSheetModal, Toast, Skeletons, Screen and the pickers on Mobile; and the remaining feature components under `apps/web/src/components`.
- Mobile-only values live in the usage notes and guidelines, not in a separate theme.
