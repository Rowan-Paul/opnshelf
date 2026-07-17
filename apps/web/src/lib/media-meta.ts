import type {
	TmdbEpisodeDto,
	TmdbMovieDetailDto,
	TmdbPersonDetailDto,
	TmdbSeasonDetailDto,
	TmdbShowDetailDto,
} from "@opnshelf/api";

export type PageMeta = {
	title: string;
	description: string;
	imageUrl?: string;
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

function getTmdbOriginalImageUrl(path?: string): string | undefined {
	return path ? `https://image.tmdb.org/t/p/original${path}` : undefined;
}

export function getOpenGraphMetaDescriptors(meta: PageMeta, pageUrl?: string) {
	const descriptors: Array<
		{ property: string; content: string } | { name: string; content: string }
	> = [
		{ property: "og:title", content: meta.title },
		{ property: "og:description", content: meta.description },
	];

	if (pageUrl) {
		descriptors.push({ property: "og:url", content: pageUrl });
	}

	if (meta.imageUrl) {
		descriptors.push(
			{ property: "og:image", content: meta.imageUrl },
			{ name: "twitter:image", content: meta.imageUrl },
		);
	}

	return descriptors;
}

export function buildMoviePageMeta(
	movie?: TmdbMovieDetailDto | null,
	fallbackTitle = "Movie",
): PageMeta {
	if (!movie) {
		return {
			title: `${fallbackTitle} | Movies | Opnshelf`,
			description: `View details, cast, and activity for ${fallbackTitle} on Opnshelf.`,
		};
	}

	const year = getYear(movie.release_date);
	const movieTitle = year ? `${movie.title} (${year})` : movie.title;

	return {
		title: `${movieTitle} | Movies | Opnshelf`,
		description: getDescription(
			movie.overview,
			`View details, cast, and watch activity for ${movie.title} on Opnshelf.`,
		),
		imageUrl: getTmdbOriginalImageUrl(movie.poster_path),
	};
}

export function buildShowPageMeta(
	show?: TmdbShowDetailDto | null,
	fallbackTitle = "Show",
): PageMeta {
	if (!show) {
		return {
			title: `${fallbackTitle} | Shows | Opnshelf`,
			description: `Track episodes, seasons, and watch progress for ${fallbackTitle} on Opnshelf.`,
		};
	}

	const year = getYear(show.first_air_date);
	const showTitle = year ? `${show.name} (${year})` : show.name;

	return {
		title: `${showTitle} | Shows | Opnshelf`,
		description: getDescription(
			show.overview,
			`Track episodes, seasons, and watch progress for ${show.name} on Opnshelf.`,
		),
		imageUrl: getTmdbOriginalImageUrl(show.poster_path),
	};
}

export function buildSeasonPageMeta(
	show: Pick<TmdbShowDetailDto, "name" | "poster_path"> | null | undefined,
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

	const imagePath = season?.poster_path || show?.poster_path;

	return {
		title: `${titleBase} | Opnshelf`,
		description: getDescription(
			season?.overview,
			`Browse episodes and details for ${showName} season ${safeSeasonNumber ?? ""} on Opnshelf.`.trim(),
		),
		imageUrl: getTmdbOriginalImageUrl(imagePath),
	};
}

export function buildEpisodePageMeta(
	show: Pick<TmdbShowDetailDto, "name" | "poster_path"> | null | undefined,
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

	const imagePath = episode?.still_path || show?.poster_path;

	return {
		title: `${titleBase || showName} | Opnshelf`,
		description: getDescription(
			episode?.overview,
			`View details for ${showName} ${numbering} on Opnshelf.`.trim(),
		),
		imageUrl: getTmdbOriginalImageUrl(imagePath),
	};
}

export function buildPersonPageMeta(
	person?: TmdbPersonDetailDto | null,
	fallbackTitle = "Person",
): PageMeta {
	if (!person) {
		return {
			title: `${fallbackTitle} | People | Opnshelf`,
			description: `View filmography, biography, and details for ${fallbackTitle} on Opnshelf.`,
		};
	}

	return {
		title: `${person.name} | People | Opnshelf`,
		description: getDescription(
			person.biography,
			`Explore the filmography and biography of ${person.name} on Opnshelf.`,
		),
		imageUrl: getTmdbOriginalImageUrl(person.profile_path),
	};
}
