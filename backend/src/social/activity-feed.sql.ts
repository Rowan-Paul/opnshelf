import { Prisma } from "../generated/client";

/**
 * Raw SQL for the Activity Feed and the followed-watchers summaries.
 *
 * An Activity is a projection over Watches (TrackedMovie / TrackedEpisode with
 * a watched date) and Reviews, so the feed is a UNION ALL over those tables
 * rather than a stored entity. Every value is bound through `Prisma.sql`
 * (`Prisma.join` for the DID list); nothing is interpolated as raw text.
 */

function joinDids(followedDids: string[]) {
	return Prisma.join(followedDids.map((did) => Prisma.sql`${did}`));
}

export function followedActivityFeedQuery(
	followedDids: string[],
	offset: number,
	limit: number,
): Prisma.Sql {
	const followedDidValues = joinDids(followedDids);
	return Prisma.sql`
			SELECT
				activity."actorDid",
				activity.id,
				activity.type,
				activity."activityAt",
				activity."watchedDate",
				activity."createdAt",
				activity."movieId",
				activity.title,
				activity."showId",
				activity."showTitle",
				activity."seasonNumber",
				activity."episodeNumber",
				activity."episodeName",
				activity."episodeOverview",
				activity."stillPath",
				activity."posterPath",
				activity."backdropPath",
				activity."releaseYear",
				activity."firstAirYear",
				activity.overview,
				activity.rating,
				activity."reviewContent",
				activity."reviewSpoiler",
				activity."reviewId"
			FROM (
				SELECT
					tm."userDid" AS "actorDid",
					'movie:' || tm.id AS id,
					'movie' AS type,
					COALESCE(tm."watchedDate", tm."createdAt") AS "activityAt",
					tm."watchedDate",
					tm."createdAt",
					tm."movieId",
					m.title,
					NULL::text AS "showId",
					NULL::text AS "showTitle",
					NULL::integer AS "seasonNumber",
					NULL::integer AS "episodeNumber",
					NULL::text AS "episodeName",
					NULL::text AS "episodeOverview",
					NULL::text AS "stillPath",
					m."posterPath",
					m."backdropPath",
					m."releaseYear",
					NULL::integer AS "firstAirYear",
					m.overview,
					NULL::integer AS rating,
					NULL::text AS "reviewContent",
					NULL::boolean AS "reviewSpoiler",
					NULL::text AS "reviewId"
				FROM "TrackedMovie" tm
				INNER JOIN "Movie" m ON m."movieId" = tm."movieId"
				WHERE tm."userDid" IN (${followedDidValues})
					AND tm."watchedDate" IS NOT NULL

				UNION ALL

				SELECT
					te."userDid" AS "actorDid",
					'episode:' || te.id AS id,
					'episode' AS type,
					COALESCE(te."watchedDate", te."createdAt") AS "activityAt",
					te."watchedDate",
					te."createdAt",
					NULL::text AS "movieId",
					NULL::text AS title,
					te."showId",
					s.title AS "showTitle",
					te."seasonNumber",
					te."episodeNumber",
					e.name AS "episodeName",
					e.overview AS "episodeOverview",
					e."stillPath",
					s."posterPath",
					s."backdropPath",
					NULL::integer AS "releaseYear",
					s."firstAirYear",
					s.overview,
					NULL::integer AS rating,
					NULL::text AS "reviewContent",
					NULL::boolean AS "reviewSpoiler",
					NULL::text AS "reviewId"
				FROM "TrackedEpisode" te
				INNER JOIN "Show" s ON s."showId" = te."showId"
				LEFT JOIN "Episode" e ON e."showId" = te."showId"
					AND e."seasonNumber" = te."seasonNumber"
					AND e."episodeNumber" = te."episodeNumber"
				WHERE te."userDid" IN (${followedDidValues})
					AND te."watchedDate" IS NOT NULL

				UNION ALL

				SELECT
					r."userDid" AS "actorDid",
					'review:' || r.id AS id,
					'review' AS type,
					r."createdAt" AS "activityAt",
					NULL::timestamp AS "watchedDate",
					r."createdAt",
					CASE WHEN r."mediaType" = 'movie' THEN r."mediaId" ELSE NULL::text END AS "movieId",
					COALESCE(m.title, s.title) AS title,
					CASE WHEN r."mediaType" != 'movie' THEN r."mediaId" ELSE NULL::text END AS "showId",
					s.title AS "showTitle",
					CASE WHEN r."mediaType" IN ('season', 'episode') THEN r."seasonNumber" ELSE NULL::integer END AS "seasonNumber",
					CASE WHEN r."mediaType" = 'episode' THEN r."episodeNumber" ELSE NULL::integer END AS "episodeNumber",
					NULL::text AS "episodeName",
					NULL::text AS "episodeOverview",
					NULL::text AS "stillPath",
					COALESCE(m."posterPath", s."posterPath") AS "posterPath",
					COALESCE(m."backdropPath", s."backdropPath") AS "backdropPath",
					m."releaseYear",
					s."firstAirYear",
					COALESCE(m.overview, s.overview) AS overview,
					rt.rating,
					r.markdown AS "reviewContent",
					r.spoiler AS "reviewSpoiler",
					r.id AS "reviewId"
				FROM "Review" r
				LEFT JOIN "Movie" m ON m."movieId" = r."mediaId" AND r."mediaType" = 'movie'
				LEFT JOIN "Show" s ON s."showId" = r."mediaId" AND r."mediaType" != 'movie'
				LEFT JOIN "Rating" rt ON rt."userDid" = r."userDid"
					AND rt."mediaType" = r."mediaType"
					AND rt."mediaId" = r."mediaId"
					AND rt."seasonNumber" = r."seasonNumber"
					AND rt."episodeNumber" = r."episodeNumber"
				WHERE r."userDid" IN (${followedDidValues})
			) activity
			ORDER BY
				activity."activityAt" DESC,
				activity."createdAt" DESC,
				activity.type DESC,
				activity.id DESC
			OFFSET ${offset}
			LIMIT ${limit}
		`;
}

export function movieWatchersQuery(
	followedDids: string[],
	movieId: string,
): Prisma.Sql {
	const followedDidValues = joinDids(followedDids);

	return Prisma.sql`
			SELECT
				watchers."actorDid",
				watchers."activityAt",
				watchers."createdAt"
			FROM (
				SELECT DISTINCT ON (tm."userDid")
					tm."userDid" AS "actorDid",
					COALESCE(tm."watchedDate", tm."createdAt") AS "activityAt",
					tm."createdAt"
				FROM "TrackedMovie" tm
				WHERE tm."userDid" IN (${followedDidValues})
					AND tm."movieId" = ${movieId}
				ORDER BY
					tm."userDid",
					COALESCE(tm."watchedDate", tm."createdAt") DESC,
					tm."createdAt" DESC,
					tm.id DESC
			) watchers
			ORDER BY
				watchers."activityAt" DESC,
				watchers."createdAt" DESC,
				watchers."actorDid" ASC
		`;
}

export type ShowWatcherScope = {
	showId: string;
	seasonNumber?: number;
	episodeNumber?: number;
};

export function showWatchersQuery(
	followedDids: string[],
	scope: ShowWatcherScope,
): Prisma.Sql {
	const followedDidValues = joinDids(followedDids);
	const seasonCondition =
		typeof scope.seasonNumber === "number"
			? Prisma.sql` AND te."seasonNumber" = ${scope.seasonNumber}`
			: Prisma.empty;
	const episodeCondition =
		typeof scope.episodeNumber === "number"
			? Prisma.sql` AND te."episodeNumber" = ${scope.episodeNumber}`
			: Prisma.empty;

	return Prisma.sql`
			SELECT
				watchers."actorDid",
				watchers."activityAt",
				watchers."createdAt"
			FROM (
				SELECT DISTINCT ON (te."userDid")
					te."userDid" AS "actorDid",
					COALESCE(te."watchedDate", te."createdAt") AS "activityAt",
					te."createdAt"
				FROM "TrackedEpisode" te
				WHERE te."userDid" IN (${followedDidValues})
					AND te."showId" = ${scope.showId}
					${seasonCondition}
					${episodeCondition}
				ORDER BY
					te."userDid",
					COALESCE(te."watchedDate", te."createdAt") DESC,
					te."createdAt" DESC,
					te.id DESC
			) watchers
			ORDER BY
				watchers."activityAt" DESC,
				watchers."createdAt" DESC,
				watchers."actorDid" ASC
		`;
}
