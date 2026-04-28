import type {
	TmdbEpisodeDto,
	TmdbMovieDetailDto,
	TmdbSeasonDetailDto,
	TmdbShowDetailDto,
} from "@opnshelf/api";

type PageMeta = {
	title: string;
	description: string;
};

function getYear(date?: string) {
	if (!date) return undefined;
	const year = new Date(date).getFullYear();
	return Number.isNaN(year) ? undefined : String(year);
}

function getDescription(
	overview: string | undefined,
	fallback: string,
): string {
	const trimmed = overview?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function buildMoviePageMeta(
	movie?: TmdbMovieDetailDto | null,
	fallbackTitle = "Movie",
): PageMeta {
	if (!movie) {
		return {
			title: `${fallbackTitle} | Movies | OpnShelf`,
			description: `View details, cast, and activity for ${fallbackTitle} on OpnShelf.`,
		};
	}

	const year = getYear(movie.release_date);
	const movieTitle = year ? `${movie.title} (${year})` : movie.title;

	return {
		title: `${movieTitle} | Movies | OpnShelf`,
		description: getDescription(
			movie.overview,
			`View details, cast, and watch activity for ${movie.title} on OpnShelf.`,
		),
	};
}

export function buildShowPageMeta(
	show?: TmdbShowDetailDto | null,
	fallbackTitle = "Show",
): PageMeta {
	if (!show) {
		return {
			title: `${fallbackTitle} | Shows | OpnShelf`,
			description: `Track episodes, seasons, and watch progress for ${fallbackTitle} on OpnShelf.`,
		};
	}

	const year = getYear(show.first_air_date);
	const showTitle = year ? `${show.name} (${year})` : show.name;

	return {
		title: `${showTitle} | Shows | OpnShelf`,
		description: getDescription(
			show.overview,
			`Track episodes, seasons, and watch progress for ${show.name} on OpnShelf.`,
		),
	};
}

export function buildSeasonPageMeta(
	show: Pick<TmdbShowDetailDto, "name"> | null | undefined,
	season?: TmdbSeasonDetailDto | null,
	seasonNumber?: string | number,
): PageMeta {
	const normalizedSeasonNumber =
		typeof seasonNumber === "number" ? seasonNumber : Number(seasonNumber);
	const safeSeasonNumber = Number.isNaN(normalizedSeasonNumber)
		? season?.season_number
		: normalizedSeasonNumber;
	const showName = show?.name || "Show";
	const seasonName = season?.name?.trim();
	const titleBase =
		seasonName && !/^season\s+\d+$/i.test(seasonName)
			? `${showName} - ${seasonName}`
			: `${showName} Season ${safeSeasonNumber ?? ""}`.trim();

	return {
		title: `${titleBase} | OpnShelf`,
		description: getDescription(
			season?.overview,
			`Browse episodes and details for ${showName} season ${safeSeasonNumber ?? ""} on OpnShelf.`.trim(),
		),
	};
}

export function buildEpisodePageMeta(
	show: Pick<TmdbShowDetailDto, "name"> | null | undefined,
	episode?: TmdbEpisodeDto | null,
	params?: {
		seasonNumber?: string | number;
		episodeNumber?: string | number;
	},
): PageMeta {
	const showName = show?.name || "Show";
	const seasonNumber =
		episode?.season_number ??
		(typeof params?.seasonNumber === "number"
			? params.seasonNumber
			: Number(params?.seasonNumber));
	const episodeNumber =
		episode?.episode_number ??
		(typeof params?.episodeNumber === "number"
			? params.episodeNumber
			: Number(params?.episodeNumber));
	const numbering =
		Number.isNaN(seasonNumber) || Number.isNaN(episodeNumber)
			? ""
			: `S${seasonNumber}E${episodeNumber}`;
	const episodeName = episode?.name?.trim();
	const titleBase = [showName, numbering, episodeName]
		.filter(Boolean)
		.join(" ");

	return {
		title: `${titleBase || showName} | OpnShelf`,
		description: getDescription(
			episode?.overview,
			`View details for ${showName} ${numbering} on OpnShelf.`.trim(),
		),
	};
}
