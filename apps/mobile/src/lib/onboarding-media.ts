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

/**
 * Fit the full card, poster plus a two-line title block, inside the measured
 * stack area between the onboarding heading and the swipe controls.
 */
export function onboardingCardWidth(
	viewportWidth: number,
	stackHeight: number,
	compact: boolean,
) {
	// Title block: padding, two title lines, gap, and the type/year line.
	const infoHeight = compact ? 24 + 56 + 4 + 16 : 32 + 56 + 8 + 20;
	// Room for the next card peeking 8px below the current one.
	const heightConstrainedWidth = Math.floor(
		(stackHeight - infoHeight - 8) / 1.5,
	);
	return Math.max(0, Math.min(viewportWidth - 64, 280, heightConstrainedWidth));
}
