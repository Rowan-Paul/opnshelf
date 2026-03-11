export type TMDBTrailerSourceMediaType =
	| "movie"
	| "show"
	| "season"
	| "episode";

export type TMDBVideo = {
	id: string;
	key: string;
	name: string;
	site: string;
	type: string;
	official?: boolean;
	published_at?: string;
};

export type TMDBTrailer = {
	id: string;
	key: string;
	name: string;
	site: string;
	type: string;
	official?: boolean;
	published_at?: string;
	sourceMediaType: TMDBTrailerSourceMediaType;
};

type TrailerCandidate = TMDBVideo & {
	score: number;
};

export function selectBestTMDBTrailer(
	videos: TMDBVideo[] | undefined,
	sourceMediaType: TMDBTrailerSourceMediaType,
): TMDBTrailer | undefined {
	if (!videos?.length) {
		return undefined;
	}

	const rankedCandidates: TrailerCandidate[] = videos
		.filter((video) => video.site === "YouTube" && video.key)
		.map((video, index) => ({
			...video,
			score: getVideoScore(video, index),
		}))
		.sort((a, b) => a.score - b.score);

	const best = rankedCandidates[0];

	if (!best) {
		return undefined;
	}

	return {
		id: best.id,
		key: best.key,
		name: best.name,
		site: best.site,
		type: best.type,
		official: best.official,
		published_at: best.published_at,
		sourceMediaType,
	};
}

function getVideoScore(video: TMDBVideo, index: number): number {
	const isTrailer = video.type === "Trailer";
	const isTeaser = video.type === "Teaser";
	const isOfficial = Boolean(video.official);

	if (isTrailer && isOfficial) {
		return index;
	}

	if (isTrailer) {
		return 100 + index;
	}

	if (isTeaser && isOfficial) {
		return 200 + index;
	}

	if (isTeaser) {
		return 300 + index;
	}

	return 400 + index;
}
