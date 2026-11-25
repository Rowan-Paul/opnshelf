import type { MovieCollectionDto, MovieWatchCountDto } from "./generated";
import { movieWatchCount } from "./list-memberships";

export interface MovieCollectionRailItem {
	id: string;
	title: string;
	posterPath?: string;
	year?: number;
	position: number;
	isCurrent: boolean;
	isWatched: boolean;
}

export interface MovieCollectionRail {
	name: string;
	position: number;
	total: number;
	watchedCount: number;
	items: MovieCollectionRailItem[];
}

export function movieCollectionName(name: string): string {
	return name.replace(/\s+collection$/i, "").trim() || name;
}

export function movieCollectionRail(
	collection: MovieCollectionDto | undefined,
	movieId: string,
	watchCounts?: MovieWatchCountDto[],
): MovieCollectionRail | undefined {
	const movies = collection?.movies ?? [];
	const current = movies.findIndex((movie) => String(movie.id) === movieId);
	if (!collection || movies.length < 2 || current < 0) return undefined;

	const watched = movies.map(
		(movie) => movieWatchCount(watchCounts, String(movie.id)) > 0,
	);
	const watchedCount = watched.filter(Boolean).length;

	return {
		name: movieCollectionName(collection.name),
		position: current + 1,
		total: movies.length,
		watchedCount,
		items: movies.map((movie, index) => ({
			id: String(movie.id),
			title: movie.title,
			posterPath: movie.poster_path,
			year: movie.release_date
				? Number(movie.release_date.slice(0, 4))
				: undefined,
			position: index + 1,
			isCurrent: index === current,
			isWatched: watched[index],
		})),
	};
}
