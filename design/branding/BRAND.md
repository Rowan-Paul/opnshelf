# Opnshelf brand starter

## Brand idea

The mark combines three cues in one compact silhouette:

- an open shelf, reflecting the product's personal media collection;
- a lowercase `o`, giving the symbol a direct connection to Opnshelf;
- an amber media tile on the shelf, representing a movie, episode, review, or list item.

The open right edge conveys discovery and sharing. The mark intentionally avoids generic play buttons, film reels, clapperboards, and stars.

## Core palette

| Role | Name | Hex |
| --- | --- | --- |
| Primary | Slate Ink | `#0F172A` |
| Accent | Screen Amber | `#F3BC00` |
| Light canvas | Paper | `#F8FAFC` |
| Dark canvas | Deep Night | `#020617` |

These values align with the existing web and mobile design tokens. On dark surfaces, use Paper for the shelf shape and retain Screen Amber for the tile.

## Typography

Use **Plus Jakarta Sans Bold** for the wordmark and display headings. Use **Inter** for interface and body copy. The SVG lockup keeps the wordmark as live text so it stays consistent with the product; convert it to outlines before sending artwork to third parties.

## Usage

- Use the horizontal lockup when the brand name needs to be explicit.
- Use the standalone mark for favicons, compact navigation, social avatars, and watermarks.
- Use the app-icon treatment for iOS and Android launchers.
- Preserve clear space around the mark equal to the height of its amber tile.
- Do not recolor the amber tile, add gradients or shadows, rotate the mark, or place other artwork inside its open edge.
- Below 24 px, use the standalone mark and remove the amber tile only if reproduction makes it indistinct.

## Clearance status

This identity is suitable for internal implementation and testing, but it has not received legal trademark clearance. A practical web screen found no exact duplicate of the complete mark, while identifying two areas to resolve before public or app-store rollout:

- several live products use the phonetically identical **OpenShelf/Openshelf** name, including a personal-library tracker and a cross-media platform;
- dark app tiles with yellow or amber accents are common among media products such as Plex, TV Time, and JustWatch.

Keep the amber media tile in normal reproductions because it helps distinguish the mark from generic open-C and open-book symbols. Before launch, run formal name/trademark clearance in target markets and reverse-image-search the final silhouette.

## Files

- `opnshelf-mark.svg`: transparent standalone mark.
- `opnshelf-app-icon.svg`: square launcher/social treatment.
- `opnshelf-adaptive-foreground.svg`: safe-area foreground for Android adaptive icons and dark splash screens.
- `opnshelf-lockup.svg`: horizontal mark and wordmark.
- `opnshelf-brand-concept.png`: generated identity presentation and visual reference.
- `GENERATION-PROMPT.md`: the prompt and generation mode used for the concept board.
