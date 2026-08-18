import type { UnifiedSearchResultDto } from "@opnshelf/api";

export type OnboardingMediaItem = {
	id: number;
	type: "movie" | "show";
	title: string;
	posterPath?: string;
	year?: string;
	overview?: string;
	rating?: number;
};

export function toOnboardingMediaItem(
	item: UnifiedSearchResultDto,
): OnboardingMediaItem {
	const isMovie = item.media_type === "movie";
	const date = isMovie ? item.release_date : item.first_air_date;
	const year = date?.slice(0, 4);
	return {
		id: item.id,
		type: isMovie ? "movie" : "show",
		title: (isMovie ? item.title : item.name) || "Untitled",
		posterPath: item.poster_path,
		year: year && /^\d{4}$/.test(year) ? year : undefined,
		overview: item.overview,
		rating: item.vote_average,
	};
}

export function isSwipeAccepted(translationX: number, width: number) {
	return Math.abs(translationX) >= width * 0.25;
}
