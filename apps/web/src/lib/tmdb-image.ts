const TMDB_POSTER = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w500(\/.+)$/;
const TMDB_BACKDROP = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w1280(\/.+)$/;

function srcSet(
	url: string | undefined,
	pattern: RegExp,
	widths: number[],
): string | undefined {
	const match = url?.match(pattern);
	if (!match) return undefined;
	const [, base, path] = match;
	return widths.map((w) => `${base}w${w}${path} ${w}w`).join(", ");
}

/** TMDB's smaller poster sizes for a w500 poster URL, or undefined for others. */
export function posterSrcSet(url: string | undefined): string | undefined {
	return srcSet(url, TMDB_POSTER, [185, 342, 500]);
}

/**
 * w780 alongside a w1280 backdrop or still URL, or undefined for others, so
 * screens that draw the hero under 780 device pixels wide skip w1280.
 */
export function backdropSrcSet(url: string | undefined): string | undefined {
	return srcSet(url, TMDB_BACKDROP, [780, 1280]);
}
