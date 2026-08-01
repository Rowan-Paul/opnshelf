import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBody,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	type DiscoverShowsDto,
	EpisodeHistoryItemDto,
	LocalEpisodeDto,
	LocalSeasonDto,
	MarkedEpisodesResponseDto,
	MarkEpisodeWatchedDto,
	MarkSeasonWatchedDto,
	MarkShowWatchedDto,
	PaginatedEpisodesQueryDto,
	PaginatedEpisodesResponseDto,
	PaginatedUpNextQueryDto,
	PaginatedUpNextResponseDto,
	ReleaseCalendarQueryDto,
	ReleaseCalendarResponseDto,
	SearchShowsResultsDto,
	TMDBEpisodeDto,
	TMDBSeasonDetailDto,
	TMDBShowDetailDto,
	TrackedEpisodeDto,
	TrackedShowSummaryDto,
} from "./dto/show.dto";
import {
	FullCreditsDto,
	WatchProvidersResponseDto,
} from "../movies/dto/movie.dto";
import type { ATSession } from "./shows.service";
import { ShowsService } from "./shows.service";

@ApiTags("shows")
@Controller("shows")
export class ShowsController {
	private readonly logger = new Logger(ShowsController.name);

	constructor(private readonly showsService: ShowsService) {}

	@Get("search")
	@ApiOperation({ summary: "Search shows from TMDB" })
	@ApiQuery({ name: "query", required: true, description: "Search term" })
	@ApiResponse({ status: 200, type: SearchShowsResultsDto })
	async searchShows(@Query("query") query: string) {
		return this.showsService.searchShows(query);
	}

	@Get("discover")
	@ApiOperation({ summary: "Discover popular shows from TMDB" })
	@ApiResponse({ status: 200, type: SearchShowsResultsDto })
	async discoverShows(@Query() discoverDto: DiscoverShowsDto) {
		return this.showsService.discoverShows(
			discoverDto.sortBy,
			discoverDto.page ?? 1,
			discoverDto.year,
		);
	}

	@Get("tmdb/:showId")
	@ApiOperation({ summary: "Get show details from TMDB" })
	@ApiResponse({ status: 200, type: TMDBShowDetailDto })
	async getShowDetails(@Param("showId") showId: string) {
		const showData = await this.showsService.getShowDetails(showId);
		const show = await this.showsService.upsertShow(showData);
		this.showsService
			.syncShowMetadata(showId)
			.catch((err) =>
				this.logger.warn(
					`Background sync failed for show ${showId}: ${err instanceof Error ? err.message : String(err)}`,
				),
			);
		const credits = await this.showsService.getShowCredits(showId);

		return {
			...showData,
			colors: show.colors ?? undefined,
			credits,
		};
	}

	@Get("tmdb/:showId/credits")
	@ApiOperation({
		summary:
			"Get the full cast and crew for a show, crew grouped by department",
	})
	@ApiResponse({ status: 200, type: FullCreditsDto })
	async getFullShowCredits(@Param("showId") showId: string) {
		return this.showsService.getFullShowCredits(showId);
	}

	@Get("tmdb/:showId/watch-providers")
	@ApiOperation({
		summary: "Get watch providers for a show from TMDB/JustWatch",
	})
	@ApiResponse({ status: 200, type: WatchProvidersResponseDto })
	@ApiQuery({
		name: "country",
		required: false,
		description: "ISO 3166-1 country code (e.g. US, GB)",
	})
	async getWatchProviders(
		@Param("showId") showId: string,
		@Query("country") country: string = "US",
	) {
		const data = await this.showsService.getWatchProviders(showId);
		if (!data) return { providers: null };
		const countryData = data.results[country] ?? null;
		return {
			providers: countryData,
			availableCountries: Object.keys(data.results),
		};
	}

	@Get("tmdb/:showId/recommendations")
	@ApiOperation({ summary: "Get TMDB recommendations (similar shows)" })
	@ApiResponse({ status: 200, type: SearchShowsResultsDto })
	async getRecommendations(@Param("showId") showId: string) {
		return this.showsService.getRecommendations(showId);
	}

	@Get("tmdb/:showId/season/:seasonNumber")
	@ApiOperation({ summary: "Get season details from TMDB" })
	@ApiResponse({ status: 200, type: TMDBSeasonDetailDto })
	async getSeasonDetails(
		@Param("showId") showId: string,
		@Param("seasonNumber") seasonNumber: string,
	) {
		return this.showsService.getSeasonDetails(showId, Number(seasonNumber));
	}

	@Get("tmdb/:showId/local-seasons")
	@ApiOperation({
		summary:
			"Get seasons from local database (populated via sync on first interaction)",
	})
	@ApiResponse({ status: 200, type: [LocalSeasonDto] })
	async getLocalSeasons(@Param("showId") showId: string) {
		const seasons = await this.showsService.getLocalSeasons(showId);
		return seasons.map((s) => ({
			seasonNumber: s.seasonNumber,
			name: s.name,
			posterPath: s.posterPath,
			airDate: s.airDate?.toISOString() ?? null,
			episodeCount: s._count.episodes,
		}));
	}

	@Get("tmdb/:showId/season/:seasonNumber/local-episodes")
	@ApiOperation({
		summary:
			"Get episodes from local database (populated via sync on first interaction)",
	})
	@ApiResponse({ status: 200, type: [LocalEpisodeDto] })
	async getLocalEpisodes(
		@Param("showId") showId: string,
		@Param("seasonNumber") seasonNumber: string,
	) {
		return this.showsService.getLocalEpisodes(showId, Number(seasonNumber));
	}

	@Get("tmdb/:showId/season/:seasonNumber/episode/:episodeNumber")
	@ApiOperation({ summary: "Get episode details from TMDB" })
	@ApiResponse({ status: 200, type: TMDBEpisodeDto })
	async getEpisodeDetails(
		@Param("showId") showId: string,
		@Param("seasonNumber") seasonNumber: string,
		@Param("episodeNumber") episodeNumber: string,
	) {
		const episode = await this.showsService.getEpisodeDetails(
			showId,
			Number(seasonNumber),
			Number(episodeNumber),
		);
		const context = await this.showsService.getEpisodeContext(
			showId,
			Number(seasonNumber),
			Number(episodeNumber),
		);

		return {
			...episode,
			_context: context,
		};
	}

	@Get("user/:userDid")
	@ApiOperation({ summary: "Get tracked shows for a user" })
	@ApiResponse({ status: 200, type: [TrackedShowSummaryDto] })
	async getUserShows(@Param("userDid") userDid: string) {
		const trackedShows = await this.showsService.getUserShows(userDid);
		return trackedShows.map((tracked) => ({
			showId: tracked.showId,
			watchCount: tracked.watchCount,
			latestWatchedDate: tracked.watchedDate?.toISOString(),
			show: {
				...tracked.show,
				colors: tracked.show.colors ?? undefined,
			},
		}));
	}

	@Get("user/:userDid/up-next")
	@ApiOperation({ summary: "Get up next episodes for a user" })
	@ApiResponse({ status: 200, type: PaginatedUpNextResponseDto })
	async getUserUpNext(
		@Param("userDid") userDid: string,
		@Query() query: PaginatedUpNextQueryDto,
	) {
		return this.showsService.getUserUpNext(
			userDid,
			query.page,
			query.pageSize,
			query.sortBy,
			query.sortOrder,
			query.showId,
		);
	}

	@Get("user/:userDid/release-calendar")
	@ApiOperation({
		summary:
			"Get releases for watched shows and watchlist items within a date range",
	})
	@ApiResponse({ status: 200, type: ReleaseCalendarResponseDto })
	async getUserReleaseCalendar(
		@Param("userDid") userDid: string,
		@Query() query: ReleaseCalendarQueryDto,
	) {
		return this.showsService.getUserReleaseCalendar(userDid, query);
	}

	@Get("user/:userDid/episodes")
	@ApiOperation({ summary: "Get paginated watched episodes for a user" })
	@ApiResponse({ status: 200, type: PaginatedEpisodesResponseDto })
	async getUserEpisodesPaginated(
		@Param("userDid") userDid: string,
		@Query() query: PaginatedEpisodesQueryDto,
	) {
		const limit = query.limit ?? 20;
		const result = await this.showsService.getUserEpisodesPaginated(
			userDid,
			limit,
			query.cursor,
		);

		// Ensure colors for all shows
		const itemsWithColors = await Promise.all(
			result.items.map(async (item) => {
				const colors = await this.showsService.ensureShowHasColors(item.showId);
				return {
					...item,
					watchedDate: item.watchedDate?.toISOString(),
					createdAt: item.createdAt.toISOString(),
					updatedAt: item.updatedAt.toISOString(),
					show: {
						...item.show,
						colors: colors ?? undefined,
					},
				};
			}),
		);

		return {
			items: itemsWithColors,
			nextCursor: result.nextCursor,
			total: result.total,
		};
	}

	@Post("watched")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Mark an episode as watched" })
	@ApiBody({ type: MarkEpisodeWatchedDto })
	@ApiResponse({ status: 201, type: TrackedEpisodeDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async markWatched(
		@Body() dto: MarkEpisodeWatchedDto,
		@Req() req: AuthenticatedRequest,
	) {
		const user = req.user;
		const { uri, cid, rkey, record } =
			await this.showsService.markEpisodeWatched(
				user.did,
				user.session as ATSession,
				dto.showId,
				dto.seasonNumber,
				dto.episodeNumber,
				dto.watchedAt,
			);

		try {
			const trackedEpisode = await this.showsService.indexTrackedEpisode(
				uri,
				cid,
				rkey,
				user.did,
				dto.showId,
				dto.seasonNumber,
				dto.episodeNumber,
				record.watchedAt,
			);
			return trackedEpisode;
		} catch (err: unknown) {
			this.logger.warn(
				{ err: err instanceof Error ? err.message : String(err) },
				"Failed to optimistically update DB; firehose will catch it",
			);
			return {
				uri,
				cid,
				rkey,
				showId: dto.showId,
				seasonNumber: dto.seasonNumber,
				episodeNumber: dto.episodeNumber,
				userDid: user.did,
			};
		}
	}

	@Delete("watched/:showId")
	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Unmark episode(s) as watched" })
	@ApiQuery({
		name: "mode",
		required: false,
		enum: ["latest", "all"],
		description:
			"Remove mode: latest (default) removes most recent, all removes all",
	})
	@ApiQuery({
		name: "seasonNumber",
		required: false,
		description: "Optional filter by season",
	})
	@ApiQuery({
		name: "episodeNumber",
		required: false,
		description: "Optional filter by episode",
	})
	@ApiResponse({ status: 204, description: "Episode unmarked as watched" })
	async unmarkWatched(
		@Param("showId") showId: string,
		@Query("mode") mode: "latest" | "all" = "latest",
		@Query("seasonNumber") seasonNumber: string | undefined,
		@Query("episodeNumber") episodeNumber: string | undefined,
		@Req() req: AuthenticatedRequest,
	) {
		const user = req.user;
		await this.showsService.unmarkEpisodeWatched(
			user.did,
			user.session as ATSession,
			showId,
			mode,
			seasonNumber ? Number(seasonNumber) : undefined,
			episodeNumber ? Number(episodeNumber) : undefined,
		);

		try {
			if (mode === "all") {
				await this.showsService.removeAllTrackedEpisodes(
					user.did,
					showId,
					seasonNumber ? Number(seasonNumber) : undefined,
					episodeNumber ? Number(episodeNumber) : undefined,
				);
			} else {
				await this.showsService.removeLatestTrackedEpisode(
					user.did,
					showId,
					seasonNumber ? Number(seasonNumber) : undefined,
					episodeNumber ? Number(episodeNumber) : undefined,
				);
			}
		} catch (err: unknown) {
			this.logger.warn(
				{ err: err instanceof Error ? err.message : String(err) },
				"Failed to optimistically remove from DB; firehose will catch it",
			);
		}
	}

	@Get(":showId")
	@ApiOperation({ summary: "Get show from database" })
	@ApiResponse({ status: 200, type: TrackedShowSummaryDto })
	async getShow(@Param("showId") showId: string) {
		const show = await this.showsService.getShowByTMDBId(showId);
		if (!show) {
			return null;
		}
		const colors = await this.showsService.ensureShowHasColors(showId);
		return {
			...show,
			colors: colors ?? undefined,
		};
	}

	@Get("user/:userDid/show/:showId/history")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Get watch history for a specific show" })
	@ApiParam({ name: "userDid", description: "User DID" })
	@ApiParam({ name: "showId", description: "TMDB show ID" })
	@ApiResponse({
		status: 200,
		description: "Watch history retrieved successfully",
		type: [EpisodeHistoryItemDto],
	})
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async getShowWatchHistory(
		@Param("userDid") userDid: string,
		@Param("showId") showId: string,
		@Req() req: AuthenticatedRequest,
	) {
		if (req.user.did !== userDid) {
			throw new Error("Unauthorized");
		}
		return this.showsService.getEpisodeWatchHistory(userDid, showId);
	}

	@Delete("history/:trackedEpisodeId")
	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Delete a specific episode watch history entry" })
	@ApiParam({
		name: "trackedEpisodeId",
		description: "Tracked episode entry ID",
	})
	@ApiResponse({ status: 204, description: "Watch history entry deleted" })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	@ApiResponse({ status: 404, description: "Tracked episode entry not found" })
	async deleteEpisodeWatchHistoryEntry(
		@Param("trackedEpisodeId") trackedEpisodeId: string,
		@Req() req: AuthenticatedRequest,
	) {
		await this.showsService.removeTrackedEpisodeById(
			req.user.did,
			req.user.session as ATSession,
			trackedEpisodeId,
		);
	}

	@Post("season/watched")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Mark all episodes in a season as watched" })
	@ApiBody({ type: MarkSeasonWatchedDto })
	@ApiResponse({ status: 201, type: MarkedEpisodesResponseDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async markSeasonWatched(
		@Body() dto: MarkSeasonWatchedDto,
		@Req() req: AuthenticatedRequest,
	) {
		const user = req.user;
		return this.showsService.markSeasonWatched(
			user.did,
			user.session as ATSession,
			dto.showId,
			dto.seasonNumber,
			dto.watchedAt,
		);
	}

	@Post("show/watched")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Mark all episodes in a show as watched" })
	@ApiBody({ type: MarkShowWatchedDto })
	@ApiResponse({ status: 201, type: MarkedEpisodesResponseDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async markShowWatched(
		@Body() dto: MarkShowWatchedDto,
		@Req() req: AuthenticatedRequest,
	) {
		const user = req.user;
		return this.showsService.markShowWatched(
			user.did,
			user.session as ATSession,
			dto.showId,
			dto.watchedAt,
		);
	}
}
