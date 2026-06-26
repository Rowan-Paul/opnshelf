import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../generated/client";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { UnifiedSearchResultDto } from "../search/dto/search.dto";
import { ShowsService } from "../shows/shows.service";
import { TmdbHttpClient, tmdbErrorForResponse } from "../tmdb/tmdb-http";
import {
	type BecauseYouWatchedRowDto,
	type DiscoverSectionResponseDto,
} from "./dto/discover.dto";

/** Raw TMDB list item (movie, show, or mixed trending entry). */
interface RawTmdbItem {
	id: number;
	media_type?: string;
	title?: string;
	name?: string;
	poster_path?: string;
	backdrop_path?: string;
	release_date?: string;
	first_air_date?: string;
	overview?: string;
	popularity?: number;
	vote_average?: number;
	vote_count?: number;
}

/** A title surfaced from the local follow graph. */
interface FromFollowsRow {
	id: string;
	media_type: "movie" | "tv";
	title: string;
	poster_path: string | null;
	backdrop_path: string | null;
	year: number | null;
}

const SECTION_LIMIT = 20;
const SEED_COUNT = 3;
const HIGH_RATING = 7;

@Injectable()
export class DiscoverService {
	private readonly tmdbApiKey: string;
	private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";
	private readonly http: TmdbHttpClient;

	constructor(
		private readonly prisma: PrismaService,
		private readonly moviesService: MoviesService,
		private readonly showsService: ShowsService,
		config: ConfigService,
	) {
		this.tmdbApiKey = config.get("TMDB_API_KEY") ?? "";
		this.http = new TmdbHttpClient(this.tmdbApiKey, DiscoverService.name);
	}

	/** Globally trending movies + shows this week (no personalization). */
	async trending(): Promise<DiscoverSectionResponseDto> {
		const response = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/trending/all/week?api_key=${this.tmdbApiKey}`,
			"trending:all:week",
		);
		if (!response.ok) {
			throw tmdbErrorForResponse(response, "Failed to fetch trending");
		}
		const data = await response.json<{ results: RawTmdbItem[] }>();
		const results = data.results
			.filter((item) => item.media_type === "movie" || item.media_type === "tv")
			.slice(0, SECTION_LIMIT)
			.map((item) =>
				mapTmdbItem(item, item.media_type === "tv" ? "tv" : "movie"),
			);
		return { results };
	}

	/**
	 * Titles the people you follow watched or rated >=7 that you haven't
	 * tracked, watchlisted, or rated yourself — ranked by how many distinct
	 * follows engaged, tiebroken by recency.
	 */
	async fromFollows(viewerDid: string): Promise<DiscoverSectionResponseDto> {
		const follows = await this.prisma.follow.findMany({
			where: { followerDid: viewerDid },
			select: { followingDid: true },
		});
		const followedDids = follows.map((f) => f.followingDid);
		if (followedDids.length === 0) return { results: [] };

		const dids = Prisma.join(followedDids.map((d) => Prisma.sql`${d}`));

		const movieRows = await this.prisma.$queryRaw<FromFollowsRow[]>(Prisma.sql`
			SELECT m."movieId" AS id, 'movie' AS media_type, m.title AS title,
				m."posterPath" AS poster_path, m."backdropPath" AS backdrop_path,
				m."releaseYear" AS year
			FROM (
				SELECT "userDid" AS uid, "movieId" AS mid, "watchedDate" AS at
					FROM "TrackedMovie"
					WHERE "userDid" IN (${dids}) AND status = 'watched'
				UNION ALL
				SELECT "userDid" AS uid, "mediaId" AS mid, "updatedAt" AS at
					FROM "Rating"
					WHERE "userDid" IN (${dids}) AND "mediaType" = 'movie'
						AND rating >= ${HIGH_RATING}
			) e
			JOIN "Movie" m ON m."movieId" = e.mid
			WHERE e.mid NOT IN (SELECT "movieId" FROM "TrackedMovie" WHERE "userDid" = ${viewerDid})
				AND e.mid NOT IN (SELECT "mediaId" FROM "Rating" WHERE "userDid" = ${viewerDid} AND "mediaType" = 'movie')
				AND e.mid NOT IN (
					SELECT li."mediaId" FROM "ListItem" li
					JOIN "List" l ON l.id = li."listId"
					WHERE l."userDid" = ${viewerDid} AND li."mediaType" = 'movie'
				)
			GROUP BY m."movieId", m.title, m."posterPath", m."backdropPath", m."releaseYear"
			ORDER BY COUNT(DISTINCT e.uid) DESC, MAX(e.at) DESC NULLS LAST
			LIMIT ${SECTION_LIMIT}
		`);

		const showRows = await this.prisma.$queryRaw<FromFollowsRow[]>(Prisma.sql`
			SELECT s."showId" AS id, 'tv' AS media_type, s.title AS title,
				s."posterPath" AS poster_path, s."backdropPath" AS backdrop_path,
				s."firstAirYear" AS year
			FROM (
				SELECT "userDid" AS uid, "showId" AS sid, "watchedDate" AS at
					FROM "TrackedEpisode"
					WHERE "userDid" IN (${dids}) AND status = 'watched'
				UNION ALL
				SELECT "userDid" AS uid, "mediaId" AS sid, "updatedAt" AS at
					FROM "Rating"
					WHERE "userDid" IN (${dids}) AND "mediaType" = 'show'
						AND rating >= ${HIGH_RATING}
			) e
			JOIN "Show" s ON s."showId" = e.sid
			WHERE e.sid NOT IN (SELECT "showId" FROM "TrackedEpisode" WHERE "userDid" = ${viewerDid})
				AND e.sid NOT IN (SELECT "mediaId" FROM "Rating" WHERE "userDid" = ${viewerDid} AND "mediaType" = 'show')
				AND e.sid NOT IN (
					SELECT li."mediaId" FROM "ListItem" li
					JOIN "List" l ON l.id = li."listId"
					WHERE l."userDid" = ${viewerDid} AND li."mediaType" = 'show'
				)
			GROUP BY s."showId", s.title, s."posterPath", s."backdropPath", s."firstAirYear"
			ORDER BY COUNT(DISTINCT e.uid) DESC, MAX(e.at) DESC NULLS LAST
			LIMIT ${SECTION_LIMIT}
		`);

		// Both rows are already follower-ranked; interleave and cap.
		const results = [...movieRows, ...showRows]
			.slice(0, SECTION_LIMIT)
			.map(mapFromFollowsRow);
		return { results };
	}

	/**
	 * One row per the viewer's few most-recent distinct watched titles, each
	 * filled with TMDB recommendations for that seed, excluding anything the
	 * viewer has already tracked.
	 */
	async becauseYouWatched(
		viewerDid: string,
	): Promise<{ rows: BecauseYouWatchedRowDto[] }> {
		const [recentMovies, recentEpisodes, trackedMovies, trackedShows] =
			await Promise.all([
				this.prisma.trackedMovie.findMany({
					where: { userDid: viewerDid, status: "watched" },
					orderBy: [
						{ watchedDate: { sort: "desc", nulls: "last" } },
						{ createdAt: "desc" },
					],
					take: 10,
					include: { movie: { select: { title: true } } },
				}),
				this.prisma.trackedEpisode.findMany({
					where: { userDid: viewerDid, status: "watched" },
					orderBy: [
						{ watchedDate: { sort: "desc", nulls: "last" } },
						{ createdAt: "desc" },
					],
					take: 20,
					include: { show: { select: { title: true } } },
				}),
				this.prisma.trackedMovie.findMany({
					where: { userDid: viewerDid },
					select: { movieId: true },
				}),
				this.prisma.trackedEpisode.findMany({
					where: { userDid: viewerDid },
					select: { showId: true },
				}),
			]);

		const trackedMovieIds = new Set(trackedMovies.map((m) => m.movieId));
		const trackedShowIds = new Set(trackedShows.map((e) => e.showId));

		// Build a recency-ordered, de-duplicated seed list across movies + shows.
		const seen = new Set<string>();
		const seeds: { id: string; mediaType: "movie" | "tv"; title: string }[] =
			[];
		const candidates = [
			...recentMovies.map((m) => ({
				id: m.movieId,
				mediaType: "movie" as const,
				title: m.movie?.title ?? "",
				at: m.watchedDate ?? m.createdAt,
			})),
			...recentEpisodes.map((e) => ({
				id: e.showId,
				mediaType: "tv" as const,
				title: e.show?.title ?? "",
				at: e.watchedDate ?? e.createdAt,
			})),
		].sort((a, b) => b.at.getTime() - a.at.getTime());

		for (const c of candidates) {
			const key = `${c.mediaType}:${c.id}`;
			if (seen.has(key) || !c.title) continue;
			seen.add(key);
			seeds.push({ id: c.id, mediaType: c.mediaType, title: c.title });
			if (seeds.length >= SEED_COUNT) break;
		}

		const rows = await Promise.all(
			seeds.map(async (seed) => {
				const recs =
					seed.mediaType === "movie"
						? await this.moviesService.getRecommendations(seed.id)
						: await this.showsService.getRecommendations(seed.id);
				const results = (recs.results as RawTmdbItem[])
					.filter((item) =>
						seed.mediaType === "movie"
							? !trackedMovieIds.has(String(item.id))
							: !trackedShowIds.has(String(item.id)),
					)
					.slice(0, SECTION_LIMIT)
					.map((item) => mapTmdbItem(item, seed.mediaType));
				return {
					seedId: Number(seed.id),
					seedMediaType: seed.mediaType,
					seedTitle: seed.title,
					results,
				};
			}),
		);

		// Drop seeds whose recommendation row came back empty after exclusion.
		return { rows: rows.filter((row) => row.results.length > 0) };
	}
}

function mapTmdbItem(
	item: RawTmdbItem,
	mediaType: "movie" | "tv",
): UnifiedSearchResultDto {
	return {
		id: item.id,
		media_type: mediaType,
		title: item.title,
		name: item.name,
		poster_path: item.poster_path,
		backdrop_path: item.backdrop_path,
		release_date: item.release_date,
		first_air_date: item.first_air_date,
		overview: item.overview,
		popularity: item.popularity ?? 0,
		vote_average: item.vote_average ?? 0,
		vote_count: item.vote_count ?? 0,
	};
}

function mapFromFollowsRow(row: FromFollowsRow): UnifiedSearchResultDto {
	const isoYear = row.year ? `${row.year}-01-01` : undefined;
	return {
		id: Number(row.id),
		media_type: row.media_type,
		title: row.media_type === "movie" ? row.title : undefined,
		name: row.media_type === "tv" ? row.title : undefined,
		poster_path: row.poster_path ?? undefined,
		backdrop_path: row.backdrop_path ?? undefined,
		release_date: row.media_type === "movie" ? isoYear : undefined,
		first_air_date: row.media_type === "tv" ? isoYear : undefined,
		popularity: 0,
		vote_average: 0,
		vote_count: 0,
	};
}
