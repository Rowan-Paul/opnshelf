import type {
	FollowedActivityItemDto,
	FollowedWatcherActorDto,
	FollowedWatcherDto,
	SocialActorDto,
} from "./dto/social.dto";
import type { ShowWatcherScope } from "./activity-feed.sql";

/** One row of the Activity Feed union query (see `activity-feed.sql.ts`). */
export type FollowedActivityRow = {
	actorDid: string;
	id: string;
	type: "movie" | "episode" | "review";
	activityAt: Date;
	watchedDate: Date | null;
	createdAt: Date;
	movieId: string | null;
	title: string | null;
	showId: string | null;
	showTitle: string | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	episodeName: string | null;
	episodeOverview: string | null;
	stillPath: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	releaseYear: number | null;
	firstAirYear: number | null;
	overview: string | null;
	rating: number | null;
	reviewContent: string | null;
	reviewSpoiler: boolean | null;
	reviewId: string | null;
};

export type FollowedWatcherRow = {
	actorDid: string;
	activityAt: Date;
	createdAt: Date;
};

export type ActivityColorMap = {
	movies: Map<string, unknown>;
	shows: Map<string, unknown>;
};

export function toFollowedActivityItem(
	row: FollowedActivityRow,
	actor: SocialActorDto | null,
	colorMap: ActivityColorMap,
): FollowedActivityItemDto {
	return {
		actor:
			actor ??
			({
				did: row.actorDid,
				handle: row.actorDid,
				displayName: null,
				avatar: null,
				followersCount: 0,
				followingCount: 0,
			} satisfies SocialActorDto),
		id: row.id,
		type: row.type,
		activityAt: row.activityAt.toISOString(),
		movieId: row.movieId ?? undefined,
		title: row.title ?? undefined,
		showId: row.showId ?? undefined,
		showTitle: row.showTitle ?? undefined,
		seasonNumber: row.seasonNumber ?? undefined,
		episodeNumber: row.episodeNumber ?? undefined,
		episodeName: row.episodeName ?? undefined,
		episodeOverview: row.episodeOverview ?? undefined,
		stillPath: row.stillPath ?? undefined,
		posterPath: row.posterPath ?? undefined,
		backdropPath: row.backdropPath ?? undefined,
		releaseYear: row.releaseYear ?? undefined,
		firstAirYear: row.firstAirYear ?? undefined,
		overview: row.overview ?? undefined,
		colors:
			row.type === "movie"
				? ((row.movieId ? colorMap.movies.get(row.movieId) : undefined) as
						| FollowedActivityItemDto["colors"]
						| undefined)
				: ((row.showId ? colorMap.shows.get(row.showId) : undefined) as
						| FollowedActivityItemDto["colors"]
						| undefined),
		watchedDate: row.watchedDate?.toISOString(),
		rating: row.rating ?? undefined,
		reviewContent: row.reviewContent ?? undefined,
		reviewSpoiler: row.reviewSpoiler ?? undefined,
		reviewId: row.reviewId ?? undefined,
		createdAt: row.createdAt.toISOString(),
	};
}

export function toFollowedWatcherItem(
	row: FollowedWatcherRow,
	actor: FollowedWatcherActorDto | null,
): FollowedWatcherDto {
	return {
		actor:
			actor ??
			({
				did: row.actorDid,
				handle: row.actorDid,
				displayName: null,
				avatar: null,
			} satisfies FollowedWatcherActorDto),
		activityAt: row.activityAt.toISOString(),
	};
}

/**
 * Show-scoped media ids arrive as `showId`, `showId:season:N` or
 * `showId:season:N:episode:M`; anything else is treated as a bare show id.
 */
export function parseScopedShowMediaId(mediaId: string): ShowWatcherScope {
	const episodeMatch = mediaId.match(/^([^:]+):season:(\d+):episode:(\d+)$/);
	if (episodeMatch) {
		return {
			showId: episodeMatch[1],
			seasonNumber: Number(episodeMatch[2]),
			episodeNumber: Number(episodeMatch[3]),
		};
	}

	const seasonMatch = mediaId.match(/^([^:]+):season:(\d+)$/);
	if (seasonMatch) {
		return {
			showId: seasonMatch[1],
			seasonNumber: Number(seasonMatch[2]),
		};
	}

	return { showId: mediaId };
}
