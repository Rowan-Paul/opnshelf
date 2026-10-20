export type WatchlistShortcutInput =
	| { query: string }
	| { mediaType: "movie" | "show"; mediaId: string };

/** Only resolve supported movie/show links; never fetch an arbitrary supplied URL. */
export function parseWatchlistInput(
	input: string,
): WatchlistShortcutInput | null {
	const value = input.trim();
	if (!value || value.length > 2048) return null;
	if (!value.includes("://") && !/^www\./i.test(value)) {
		return value.length <= 200 ? { query: value } : null;
	}
	try {
		const url = new URL(value);
		if (
			!["http:", "https:"].includes(url.protocol) ||
			url.username ||
			url.password ||
			url.port
		)
			return null;
		const site = [
			"opnshelf.xyz",
			"www.opnshelf.xyz",
			"staging.opnshelf.xyz",
		].includes(url.hostname);
		const tmdb = ["themoviedb.org", "www.themoviedb.org"].includes(
			url.hostname,
		);
		const match = site
			? /^\/(movies|shows)\/([1-9]\d*)(?:\/[^/]+)?\/?$/.exec(url.pathname)
			: tmdb
				? /^\/(movie|tv)\/([1-9]\d*)(?:-[^/]+)?\/?$/.exec(url.pathname)
				: null;
		if (!match || !Number.isSafeInteger(Number(match[2]))) return null;
		return {
			mediaType:
				match[1] === "movies" || match[1] === "movie"
					? ("movie" as const)
					: ("show" as const),
			mediaId: match[2],
		};
	} catch {
		return null;
	}
}
