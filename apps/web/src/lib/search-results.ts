import type {
	TmdbMovieResultDto,
	TmdbShowResultDto,
	UnifiedSearchResultDto,
} from "@opnshelf/api";
import { z } from "zod";

/**
 * Pure URL-state and result-shaping logic for the Search route. The route
 * owns the queries and rendering; this module owns everything that can be
 * checked without a router or a network.
 */

export const searchRouteSchema = z.object({
	q: z.string().optional(),
	type: z.string().optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
});

export type SearchRouteParams = z.infer<typeof searchRouteSchema>;

export const SEARCH_TABS = [
	"all",
	"movies",
	"shows",
	"cast",
	"people",
] as const;

export type SearchTab = (typeof SEARCH_TABS)[number];

export function isSearchTab(value: unknown): value is SearchTab {
	return SEARCH_TABS.includes(value as SearchTab);
}

/** The tab a `?type=` value selects; unknown or missing values fall back to All. */
export function resolveSearchTab(type: string | undefined): SearchTab {
	return isSearchTab(type) ? type : "all";
}

export type SearchLocation = { q?: string; type?: string; page?: number };

export type SearchState = { query: string; tab: SearchTab; page: number };

/**
 * The URL search params for a piece of local state. Defaults (empty query,
 * All tab, first page) are left out so the URL stays canonical, and an
 * all-default state yields `undefined` so the route gets no `?` at all.
 */
export function buildSearchLocation({
	query,
	tab,
	page,
}: SearchState): SearchLocation | undefined {
	const newSearch: SearchLocation = {};
	if (query) newSearch.q = query;
	if (tab !== "all") newSearch.type = tab;
	if (page > 1) newSearch.page = page;
	return Object.keys(newSearch).length > 0 ? newSearch : undefined;
}

/** Whether the URL differs from local state and has to be rewritten. */
export function searchLocationNeedsUpdate(
	{ query, tab, page }: SearchState,
	current: SearchRouteParams,
): boolean {
	return (
		query !== (current.q || "") ||
		(tab !== "all" ? tab : undefined) !== (current.type || undefined) ||
		(page > 1 ? page : undefined) !==
			(current.page > 1 ? current.page : undefined)
	);
}

export function getTitle(item: UnifiedSearchResultDto): string {
	return item.title || item.name || "Unknown";
}

export function getPosterUrl(item: UnifiedSearchResultDto): string {
	return item.poster_path
		? `https://image.tmdb.org/t/p/w500${item.poster_path}`
		: "";
}

export function getBackdropUrl(
	item: UnifiedSearchResultDto,
): string | undefined {
	return item.backdrop_path
		? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
		: undefined;
}

/**
 * TMDB discover rows come back movie- or show-shaped; DiscoverRow speaks the
 * unified search shape, so widen them here instead of teaching it a second type.
 */
export function toUnifiedResult(
	r: TmdbMovieResultDto | TmdbShowResultDto,
	mediaType: "movie" | "tv",
): UnifiedSearchResultDto {
	const movie = mediaType === "movie" ? (r as TmdbMovieResultDto) : null;
	const show = mediaType === "tv" ? (r as TmdbShowResultDto) : null;
	return {
		id: r.id,
		media_type: mediaType,
		title: movie?.title,
		name: show?.name,
		poster_path: r.poster_path,
		backdrop_path: r.backdrop_path,
		release_date: movie?.release_date,
		first_air_date: show?.first_air_date,
		overview: r.overview,
		popularity: 0,
		vote_average: r.vote_average ?? 0,
		vote_count: 0,
	};
}

type MediaRef = Pick<UnifiedSearchResultDto, "id" | "media_type">;

/** Stable key for one title across movie/tv namespaces. */
export function mediaKey(item: MediaRef): string {
	return `${item.media_type}-${item.id}`;
}

/**
 * TMDB multi-search can return the same id twice; drop repeats (keeping the
 * first) so React keys stay unique.
 */
export function dedupeResults<T extends MediaRef>(items: T[]): T[] {
	const seen = new Set<string>();
	return items.filter((r) => {
		const k = mediaKey(r);
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

/** Keys of every title already shown by earlier discovery rows. */
export function collectShownKeys(rows: MediaRef[][]): Set<string> {
	return new Set(rows.flat().map(mediaKey));
}

/**
 * Popular overlaps trending heavily, so the popular rows only show what the
 * rows above them didn't.
 */
export function toUnseenDiscoverItems(
	results: Array<TmdbMovieResultDto | TmdbShowResultDto>,
	mediaType: "movie" | "tv",
	shownKeys: Set<string>,
): UnifiedSearchResultDto[] {
	return results
		.filter((r) => !shownKeys.has(`${mediaType}-${r.id}`))
		.map((r) => toUnifiedResult(r, mediaType));
}

export function splitByMediaType(results: UnifiedSearchResultDto[]): {
	movies: UnifiedSearchResultDto[];
	shows: UnifiedSearchResultDto[];
} {
	return {
		movies: results.filter((r) => r.media_type === "movie"),
		shows: results.filter((r) => r.media_type === "tv"),
	};
}

/** The id/type pairs the batch ratings query wants for a result set. */
export function toRatingItems(
	results: UnifiedSearchResultDto[],
): Array<{ id: number; type: "movie" | "show" }> {
	return results
		.filter((r) => r.media_type === "movie" || r.media_type === "tv")
		.map((r) => ({
			id: r.id,
			type: r.media_type === "movie" ? "movie" : "show",
		}));
}

export type SearchResultCounts = {
	movies: number;
	shows: number;
	people: number;
	cast: number;
};

export function hasResultsForTab(
	tab: SearchTab,
	counts: SearchResultCounts,
): boolean {
	switch (tab) {
		case "people":
			return counts.people > 0;
		case "cast":
			return counts.cast > 0;
		case "movies":
			return counts.movies > 0;
		case "shows":
			return counts.shows > 0;
		default:
			return counts.movies > 0 || counts.shows > 0;
	}
}

/**
 * The spinner shows for the request the active tab is waiting on; the Users
 * query only runs for signed-in users, so guests never wait on it.
 */
export function isSearchTabLoading({
	tab,
	isAuthenticated,
	isSearching,
	isSearchingPeople,
	isSearchingCast,
}: {
	tab: SearchTab;
	isAuthenticated: boolean;
	isSearching: boolean;
	isSearchingPeople: boolean;
	isSearchingCast: boolean;
}): boolean {
	return (
		isSearching ||
		(isAuthenticated && isSearchingPeople && tab === "people") ||
		(isSearchingCast && tab === "cast")
	);
}

export const SEARCH_PAGE_SIZE = 20;

/** Page count for the TMDB multi-search, never below one. */
export function getSearchTotalPages(totalResults: number | undefined): number {
	return Math.max(1, Math.ceil((totalResults || 0) / SEARCH_PAGE_SIZE));
}

/** Page count for the Cast & Crew search, never below one. */
export function getCastTotalPages(totalPages: number | undefined): number {
	return Math.max(1, totalPages || 1);
}
