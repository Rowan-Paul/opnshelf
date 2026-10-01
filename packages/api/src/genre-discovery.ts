/** Shared Discover URL state; genre IDs belong to a movie or TV catalogue. */
export type GenreDiscovery = {
	type: "movies" | "shows";
	genre: number;
	genreName?: string;
};

export function genreDiscoverySearch(
	mediaType: "movie" | "show",
	genre: { id: number; name: string },
): GenreDiscovery {
	return {
		type: mediaType === "movie" ? "movies" : "shows",
		genre: genre.id,
		genreName: genre.name,
	};
}

export function parseGenreDiscovery(search: {
	type?: unknown;
	genre?: unknown;
	genreName?: unknown;
}): GenreDiscovery | undefined {
	if (search.type !== "movies" && search.type !== "shows") return;
	if (typeof search.genre !== "string" && typeof search.genre !== "number")
		return;
	const genre = Number(search.genre);
	if (!Number.isSafeInteger(genre) || genre <= 0) return;
	return {
		type: search.type,
		genre,
		genreName:
			typeof search.genreName === "string"
				? search.genreName.trim().slice(0, 100)
				: undefined,
	};
}
