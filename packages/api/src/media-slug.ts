import slugify from "slugify";

/**
 * The canonical slug for a Media Item or Person name, used as the trailing
 * segment of every media URL on both the Web App and the Mobile App.
 *
 * Shared deliberately. The two clients must produce byte-identical URLs, since
 * the Mobile App captures `opnshelf.xyz` links (ADR 0022) and its routes match
 * the web's (ADR 0023). Two copies of "roughly this logic" is the bug that
 * makes a shared link open the wrong shape.
 *
 * `strict: true` transliterates rather than mangling: "Pokémon" becomes
 * "pokemon", not "pok-mon", and "Marvel's Agents of S.H.I.E.L.D." becomes
 * "marvels-agents-of-shield". This replaced a hand-rolled
 * `[^a-z0-9]+ -> "-"` version that differed on every accented title.
 *
 * The slug is decorative: every route resolves from the numeric id alone, so a
 * stale slug in an old link still lands on the right page.
 */
export function slugifyName(name: string): string {
	return (
		slugify(name, {
			lower: true,
			strict: true,
			trim: true,
		}) ||
		// A missing or all-symbol title must still produce a segment. Without
		// this, the URL collapses to `/movies/603/` with an empty slug and
		// matches no route on either client — a dead link, not an ugly one.
		// The media title is optional in the API, so this is reachable.
		"-"
	);
}
