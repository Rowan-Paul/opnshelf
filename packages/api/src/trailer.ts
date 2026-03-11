import type {
	TmdbEpisodeDto,
	TmdbMovieDetailDto,
	TmdbSeasonDetailDto,
	TmdbShowDetailDto,
	TmdbTrailerDto,
} from "./generated/types.gen";

type DetailMediaType = "movie" | "show" | "season" | "episode";

type DetailTrailerInput = {
	mediaType: DetailMediaType;
	detailTrailer?:
		| TmdbTrailerDto
		| TmdbMovieDetailDto["trailer"]
		| TmdbShowDetailDto["trailer"]
		| TmdbSeasonDetailDto["trailer"]
		| TmdbEpisodeDto["trailer"];
	showTrailer?: TmdbTrailerDto | TmdbShowDetailDto["trailer"];
};

type ResolvedTrailer = {
	trailer: TmdbTrailerDto;
	isFallback: boolean;
};

export function resolveDetailTrailer({
	mediaType,
	detailTrailer,
	showTrailer,
}: DetailTrailerInput): ResolvedTrailer | null {
	if (mediaType === "movie" || mediaType === "show") {
		return detailTrailer ? { trailer: detailTrailer, isFallback: false } : null;
	}

	if (detailTrailer) {
		return { trailer: detailTrailer, isFallback: false };
	}

	if (showTrailer) {
		return { trailer: showTrailer, isFallback: true };
	}

	return null;
}

export function getYouTubeEmbedUrl(
	key: string,
	options: { autoplay?: boolean } = {},
): string {
	const params = new URLSearchParams({
		rel: "0",
		modestbranding: "1",
		playsinline: "1",
	});

	if (options.autoplay) {
		params.set("autoplay", "1");
	}

	return `https://www.youtube-nocookie.com/embed/${key}?${params.toString()}`;
}

export function getYouTubeThumbnailUrl(key: string): string {
	return `https://img.youtube.com/vi/${key}/hqdefault.jpg`;
}
