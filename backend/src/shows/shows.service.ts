import { Injectable } from "@nestjs/common";
import type {
	TMDBCreditsSummary,
	TMDBFullCredits,
} from "../tmdb/tmdb-credits.util";
import { buildEpisodeWatchRecord } from "./episode-watch-record";
import { type ATSession, EpisodeWatchService } from "./episode-watch.service";
import { ShowCatalogueService } from "./show-catalogue.service";
import { ShowProgressService } from "./show-progress.service";
import {
	ShowsTmdbService,
	type TMDBEpisode,
	type TMDBSearchResponse,
	type TMDBSeason,
	type TMDBShow,
	type WatchProvidersResponse,
} from "./shows-tmdb.service";

export type { ATSession } from "./episode-watch.service";

/**
 * Facade over the Show domain. Other modules (controller, ingester, library,
 * lists, search, discover, import history) depend on this one surface; the
 * work is split by concern:
 *
 * - `ShowsTmdbService`: TMDB reads (search, details, credits, providers).
 * - `ShowCatalogueService`: persisted Show/Season/Episode catalogue and its
 *   sync from TMDB.
 * - `ShowProgressService`: read models over episode Watches (Up Next,
 *   progress, release calendar, history).
 * - `EpisodeWatchService`: episode Watch writes to the PDS and their local
 *   index.
 */
@Injectable()
export class ShowsService {
	constructor(
		private showsTmdb: ShowsTmdbService,
		private catalogue: ShowCatalogueService,
		private progress: ShowProgressService,
		private watches: EpisodeWatchService,
	) {}

	// TMDB reads

	async searchShows(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		return this.showsTmdb.searchShows(query, page);
	}

	async discoverShows(
		sortBy: string = "popularity.desc",
		page: number = 1,
		year?: number,
	): Promise<TMDBSearchResponse> {
		return this.showsTmdb.discoverShows(sortBy, page, year);
	}

	async getRecommendations(
		showId: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		return this.showsTmdb.getRecommendations(showId, page);
	}

	async getShowDetails(showId: string): Promise<TMDBShow> {
		return this.showsTmdb.getShowDetails(showId);
	}

	async getShowCredits(showId: string): Promise<TMDBCreditsSummary | null> {
		return this.showsTmdb.getShowCredits(showId);
	}

	async getFullShowCredits(showId: string): Promise<TMDBFullCredits | null> {
		return this.showsTmdb.getFullShowCredits(showId);
	}

	async getWatchProviders(
		showId: string,
	): Promise<WatchProvidersResponse | null> {
		return this.showsTmdb.getWatchProviders(showId);
	}

	async getSeasonDetails(
		showId: string,
		seasonNumber: number,
	): Promise<TMDBSeason> {
		return this.showsTmdb.getSeasonDetails(showId, seasonNumber);
	}

	async getEpisodeDetails(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<TMDBEpisode> {
		return this.showsTmdb.getEpisodeDetails(
			showId,
			seasonNumber,
			episodeNumber,
		);
	}

	// Persisted catalogue

	async getEpisodeContext(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<{
		previous: { seasonNumber: number; episodeNumber: number } | null;
		next: { seasonNumber: number; episodeNumber: number } | null;
	}> {
		return this.getEpisodeContextLocal(showId, seasonNumber, episodeNumber);
	}

	async getShowByTMDBId(showId: string) {
		return this.catalogue.getShowByTMDBId(showId);
	}

	async upsertShow(showData: TMDBShow) {
		return this.catalogue.upsertShow(showData);
	}

	async syncShowMetadata(
		showId: string,
		options: { force?: boolean } = {},
	): Promise<void> {
		return this.catalogue.syncShowMetadata(showId, options);
	}

	async getEpisodeContextLocal(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<{
		previous: { seasonNumber: number; episodeNumber: number } | null;
		next: { seasonNumber: number; episodeNumber: number } | null;
	}> {
		return this.catalogue.getEpisodeContextLocal(
			showId,
			seasonNumber,
			episodeNumber,
		);
	}

	async getLocalSeasons(showId: string) {
		return this.catalogue.getLocalSeasons(showId);
	}

	async getLocalEpisodes(showId: string, seasonNumber: number) {
		return this.catalogue.getLocalEpisodes(showId, seasonNumber);
	}

	async ensureShowHasColors(showId: string): Promise<{
		primary?: string;
		secondary?: string;
		accent?: string;
		muted?: string;
	} | null> {
		return this.catalogue.ensureShowHasColors(showId);
	}

	// Watch read models

	async getUserShows(userDid: string) {
		return this.progress.getUserShows(userDid);
	}

	async getUserUpNext(
		userDid: string,
		page: number = 1,
		pageSize: number = 8,
		sortBy: "lastWatched" | "title" | "progress" = "lastWatched",
		sortOrder: "asc" | "desc" = "desc",
		showIdFilter?: string,
	) {
		return this.progress.getUserUpNext(
			userDid,
			page,
			pageSize,
			sortBy,
			sortOrder,
			showIdFilter,
		);
	}

	async getUserReleaseCalendar(
		userDid: string,
		query?: { startDate?: string; endDate?: string },
	) {
		return this.progress.getUserReleaseCalendar(userDid, query);
	}

	async getUserEpisodesPaginated(
		userDid: string,
		limit: number = 20,
		cursor?: string,
	) {
		return this.progress.getUserEpisodesPaginated(userDid, limit, cursor);
	}

	async getEpisodeWatchHistory(userDid: string, showId: string) {
		return this.progress.getEpisodeWatchHistory(userDid, showId);
	}

	async getShowProgress(userDid: string, showIds: string[]) {
		return this.progress.getShowProgress(userDid, showIds);
	}

	// Watch writes

	buildEpisodeWatchRecord(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
		customWatchedAt?: string | null,
		deterministicRkey?: string,
	) {
		return buildEpisodeWatchRecord(
			showId,
			seasonNumber,
			episodeNumber,
			customWatchedAt,
			deterministicRkey,
		);
	}

	async markEpisodeWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
		customWatchedAt?: string | null,
	) {
		return this.watches.markEpisodeWatched(
			userDid,
			session,
			showId,
			seasonNumber,
			episodeNumber,
			customWatchedAt,
		);
	}

	async indexTrackedEpisode(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
		watchedAt: string | undefined,
	) {
		return this.watches.indexTrackedEpisode(
			uri,
			cid,
			rkey,
			userDid,
			showId,
			seasonNumber,
			episodeNumber,
			watchedAt,
		);
	}

	async unmarkEpisodeWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		mode: "latest" | "all" = "latest",
		seasonNumber?: number,
		episodeNumber?: number,
	) {
		return this.watches.unmarkEpisodeWatched(
			userDid,
			session,
			showId,
			mode,
			seasonNumber,
			episodeNumber,
		);
	}

	async removeTrackedEpisodeById(
		userDid: string,
		session: ATSession,
		trackedEpisodeId: string,
	) {
		return this.watches.removeTrackedEpisodeById(
			userDid,
			session,
			trackedEpisodeId,
		);
	}

	async markSeasonWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		seasonNumber: number,
		customWatchedAt?: string | null,
	) {
		return this.watches.markSeasonWatched(
			userDid,
			session,
			showId,
			seasonNumber,
			customWatchedAt,
		);
	}

	async markShowWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		customWatchedAt?: string | null,
	) {
		return this.watches.markShowWatched(
			userDid,
			session,
			showId,
			customWatchedAt,
		);
	}
}
