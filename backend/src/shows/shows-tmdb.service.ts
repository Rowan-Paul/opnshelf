import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TmdbHttpClient } from "../tmdb/tmdb-http";
import {
	selectBestTMDBTrailer,
	type TMDBTrailer,
	type TMDBVideo,
} from "../tmdb/tmdb-trailer.util";

export interface TMDBSeasonSummary {
	id: number;
	name: string;
	season_number: number;
	episode_count?: number;
	poster_path?: string;
	air_date?: string;
	overview?: string;
	vote_average?: number;
}

export interface TMDBShow {
	id: number;
	name: string;
	poster_path?: string;
	backdrop_path?: string;
	first_air_date?: string;
	overview?: string;
	genres?: Array<{ id: number; name: string }>;
	number_of_seasons?: number;
	number_of_episodes?: number;
	seasons?: TMDBSeasonSummary[];
	popularity: number;
	vote_average: number;
	vote_count: number;
	next_episode_to_air?: TMDBEpisode | null;
	trailer?: TMDBTrailer;
}

export interface TMDBSearchResponse {
	page: number;
	results: TMDBShow[];
	total_results: number;
	total_pages: number;
}

export interface TMDBCredits {
	cast: {
		id: number;
		name: string;
		character?: string;
		profile_path?: string;
		order: number;
	}[];
	crew: {
		id: number;
		name: string;
		job?: string;
		department?: string;
		profile_path?: string;
	}[];
}

export interface TMDBEpisode {
	id: number;
	name: string;
	episode_number: number;
	season_number: number;
	air_date?: string;
	overview?: string;
	still_path?: string;
	vote_average?: number;
	trailer?: TMDBTrailer;
}

export interface TMDBSeason {
	id: number;
	name: string;
	season_number: number;
	overview?: string;
	poster_path?: string;
	air_date?: string;
	episodes: TMDBEpisode[];
	trailer?: TMDBTrailer;
}

type TMDBVideosResponse = {
	results?: TMDBVideo[];
};

export interface WatchProvider {
	logo_path: string;
	provider_id: number;
	provider_name: string;
	display_priority: number;
}

export interface WatchProvidersResult {
	link: string;
	flatrate?: WatchProvider[];
	rent?: WatchProvider[];
	buy?: WatchProvider[];
	ads?: WatchProvider[];
	free?: WatchProvider[];
}

export interface WatchProvidersResponse {
	id: number;
	results: Record<string, WatchProvidersResult>;
}

@Injectable()
export class ShowsTmdbService {
	private readonly logger = new Logger(ShowsTmdbService.name);
	private readonly tmdbApiKey: string;
	private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";
	private readonly http: TmdbHttpClient;

	constructor(private config: ConfigService) {
		this.tmdbApiKey = this.config.get("TMDB_API_KEY") ?? "";
		this.http = new TmdbHttpClient(this.tmdbApiKey, ShowsTmdbService.name);
	}

	async searchShows(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		const response = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/search/tv?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=${page}`,
			`search:tv:${query}:${page}`,
		);

		if (!response.ok) {
			throw new Error("Failed to search shows");
		}

		return response.json<TMDBSearchResponse>();
	}

	async discoverShows(
		sortBy: string = "popularity.desc",
		page: number = 1,
		year?: number,
	): Promise<TMDBSearchResponse> {
		let url = `${this.tmdbBaseUrl}/discover/tv?api_key=${this.tmdbApiKey}&sort_by=${sortBy}&page=${page}`;

		if (year) {
			url += `&first_air_date_year=${year}`;
		}

		const response = await this.http.fetchCached(
			url,
			`discover:tv:${sortBy}:${page}:${year ?? ""}`,
		);

		if (!response.ok) {
			throw new Error("Failed to discover shows");
		}

		return response.json<TMDBSearchResponse>();
	}

	async getShowDetails(showId: string): Promise<TMDBShow> {
		const [detailResponse, videosResponse] = await Promise.all([
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/tv/${showId}?api_key=${this.tmdbApiKey}`,
				`tv:detail:${showId}`,
			),
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/tv/${showId}/videos?api_key=${this.tmdbApiKey}`,
				`tv:videos:${showId}`,
			),
		]);

		if (!detailResponse.ok) {
			throw new Error("Show not found");
		}

		const show = await detailResponse.json<TMDBShow>();
		const videosData = videosResponse.ok
			? await videosResponse.json<TMDBVideosResponse>()
			: undefined;

		return {
			...show,
			trailer: selectBestTMDBTrailer(videosData?.results, "show"),
		};
	}

	async getShowCredits(showId: string): Promise<TMDBCredits | null> {
		const response = await this.http.fetch(
			`${this.tmdbBaseUrl}/tv/${showId}/credits?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch credits for show ${showId}`);
			return null;
		}

		const data = await response.json<TMDBCredits>();
		const sortedCast = (data.cast || [])
			.sort((a, b) => (a.order || 0) - (b.order || 0))
			.slice(0, 15);
		const keyJobs = [
			"Director",
			"Producer",
			"Executive Producer",
			"Screenplay",
			"Writer",
			"Creator",
			"Original Music Composer",
			"Composer",
		];
		const filteredCrew = (data.crew || [])
			.filter((member) => keyJobs.includes(member.job || ""))
			.slice(0, 10);

		return {
			cast: sortedCast,
			crew: filteredCrew,
		};
	}

	async getSeasonDetails(
		showId: string,
		seasonNumber: number,
	): Promise<TMDBSeason> {
		const [detailResponse, videosResponse] = await Promise.all([
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/tv/${showId}/season/${seasonNumber}?api_key=${this.tmdbApiKey}`,
				`tv:season:detail:${showId}:${seasonNumber}`,
			),
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/tv/${showId}/season/${seasonNumber}/videos?api_key=${this.tmdbApiKey}`,
				`tv:season:videos:${showId}:${seasonNumber}`,
			),
		]);
		if (!detailResponse.ok) {
			throw new Error("Season not found");
		}
		const season = await detailResponse.json<TMDBSeason>();
		const videosData = videosResponse.ok
			? await videosResponse.json<TMDBVideosResponse>()
			: undefined;
		return {
			...season,
			trailer: selectBestTMDBTrailer(videosData?.results, "season"),
		};
	}

	async getEpisodeDetails(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<TMDBEpisode> {
		const [detailResponse, videosResponse] = await Promise.all([
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${this.tmdbApiKey}`,
				`tv:episode:detail:${showId}:${seasonNumber}:${episodeNumber}`,
			),
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}/videos?api_key=${this.tmdbApiKey}`,
				`tv:episode:videos:${showId}:${seasonNumber}:${episodeNumber}`,
			),
		]);
		if (!detailResponse.ok) {
			throw new Error("Episode not found");
		}
		const episode = await detailResponse.json<TMDBEpisode>();
		const videosData = videosResponse.ok
			? await videosResponse.json<TMDBVideosResponse>()
			: undefined;
		return {
			...episode,
			trailer: selectBestTMDBTrailer(videosData?.results, "episode"),
		};
	}

	async getEpisodeContext(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<{
		previous: { seasonNumber: number; episodeNumber: number } | null;
		next: { seasonNumber: number; episodeNumber: number } | null;
	}> {
		const show = await this.getShowDetails(showId);
		const numberOfSeasons = show.number_of_seasons || 1;

		let previous: { seasonNumber: number; episodeNumber: number } | null = null;
		let next: { seasonNumber: number; episodeNumber: number } | null = null;

		const currentSeason = await this.getSeasonDetails(showId, seasonNumber);
		const currentEpisodes = this.getNavigableEpisodes(
			currentSeason.episodes || [],
		);

		const prevInCurrentSeason = [...currentEpisodes]
			.filter((episode) => episode.episode_number < episodeNumber)
			.sort((a, b) => b.episode_number - a.episode_number)[0];
		if (prevInCurrentSeason) {
			previous = {
				seasonNumber,
				episodeNumber: prevInCurrentSeason.episode_number,
			};
		} else if (seasonNumber > 1) {
			for (let s = seasonNumber - 1; s >= 1; s--) {
				const prevSeason = await this.getSeasonDetails(showId, s);
				const prevEpisodes = this.getNavigableEpisodes(
					prevSeason.episodes || [],
				);
				if (prevEpisodes.length > 0) {
					const lastEpisode = prevEpisodes.reduce((max, ep) =>
						ep.episode_number > max.episode_number ? ep : max,
					);
					if (lastEpisode) {
						previous = {
							seasonNumber: s,
							episodeNumber: lastEpisode.episode_number,
						};
						break;
					}
				}
			}
		}

		const nextInCurrentSeason = currentEpisodes
			.filter((episode) => episode.episode_number > episodeNumber)
			.sort((a, b) => a.episode_number - b.episode_number)[0];
		if (nextInCurrentSeason) {
			next = {
				seasonNumber,
				episodeNumber: nextInCurrentSeason.episode_number,
			};
		} else {
			for (let s = seasonNumber + 1; s <= numberOfSeasons; s++) {
				if (s === 0) {
					continue;
				}

				const nextSeason = await this.getSeasonDetails(showId, s);
				const nextEpisodes = this.getNavigableEpisodes(
					nextSeason.episodes || [],
				);
				if (nextEpisodes.length > 0) {
					const firstEpisode = nextEpisodes.reduce((min, ep) =>
						ep.episode_number < min.episode_number ? ep : min,
					);
					if (firstEpisode) {
						next = {
							seasonNumber: s,
							episodeNumber: firstEpisode.episode_number,
						};
						break;
					}
				}
			}
		}

		return { previous, next };
	}

	async getWatchProviders(
		showId: string,
	): Promise<WatchProvidersResponse | null> {
		const response = await this.http.fetch(
			`${this.tmdbBaseUrl}/tv/${showId}/watch/providers?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch watch providers for show ${showId}`);
			return null;
		}

		return response.json<WatchProvidersResponse>();
	}

	private getNavigableEpisodes(episodes: TMDBEpisode[]): TMDBEpisode[] {
		return episodes.filter((episode) => this.isNavigableEpisode(episode));
	}

	private isNavigableEpisode(episode: TMDBEpisode): boolean {
		// Exclude specials / bonus content (season 0)
		return episode.season_number !== 0;
	}
}
