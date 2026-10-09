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

/** Narrowest poster worth showing; below this the card drops the poster. */
const MIN_POSTER_WIDTH = 120;

/**
 * Fit the full card, poster plus a two-line title block, inside the measured
 * stack area between the onboarding heading and the swipe controls. Text line
 * heights grow with the system font scale, padding does not.
 */
export function onboardingCardLayout(
	viewportWidth: number,
	stackHeight: number,
	compact: boolean,
	fontScale: number,
) {
	// Title block: padding and gap, then two title lines and the type/year line.
	const infoHeight = Math.ceil(
		compact ? 24 + 4 + (56 + 16) * fontScale : 32 + 8 + (56 + 20) * fontScale,
	);
	const maxWidth = Math.min(viewportWidth - 64, 280);
	// Room for the next card peeking 8px below the current one.
	const posterWidth = Math.floor((stackHeight - infoHeight - 8) / 1.5);
	if (posterWidth < MIN_POSTER_WIDTH) {
		return { width: maxWidth, showPoster: false };
	}
	return { width: Math.min(maxWidth, posterWidth), showPoster: true };
}
