import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { BackendEnv } from "../config/env.schema";
import { TMDB_CACHE_STORE } from "../tmdb/tmdb-cache.module";
import type { TmdbCacheStore } from "../tmdb/tmdb-cache.store";
import {
	TMDB_BASE_URL,
	TMDB_DETAIL_CACHE_TTL_MS,
	TmdbHttpClient,
	tmdbErrorForResponse,
} from "../tmdb/tmdb-http";
import type {
	StreamingServiceDto,
	StreamingServicesResponseDto,
} from "./dto/streaming-service.dto";

/** Logo size TMDB serves for provider logos; w92 is the largest square size listed. */
const LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";

interface TmdbProvider {
	provider_id: number;
	provider_name: string;
	logo_path: string | null;
	display_priority: number;
	display_priorities?: Record<string, number>;
}

interface TmdbProviderListResponse {
	results: TmdbProvider[];
}

/**
 * Lists the Streaming Services available in a watch country, for the My
 * Services picker. TMDB keeps separate provider lists for movies and TV; a
 * user subscribes to a service, not a media type, so the two are merged and
 * ordered by TMDB's per-country display priority.
 */
@Injectable()
export class StreamingServicesService {
	private readonly logger = new Logger(StreamingServicesService.name);
	private readonly tmdbApiKey: string;
	private readonly http: TmdbHttpClient;

	constructor(
		config: BackendEnv,
		@Optional() @Inject(TMDB_CACHE_STORE) cacheStore?: TmdbCacheStore,
	) {
		this.tmdbApiKey = config.TMDB_API_KEY ?? "";
		this.http = new TmdbHttpClient(
			this.tmdbApiKey,
			StreamingServicesService.name,
			cacheStore,
		);
	}

	async listForCountry(country: string): Promise<StreamingServicesResponseDto> {
		const region = normalizeCountry(country);
		const [movie, tv] = await Promise.all([
			this.fetchList("movie", region),
			this.fetchList("tv", region),
		]);

		const byId = new Map<number, StreamingServiceDto>();
		for (const provider of [...movie, ...tv]) {
			const priority =
				provider.display_priorities?.[region] ?? provider.display_priority;
			const existing = byId.get(provider.provider_id);
			if (existing) {
				existing.displayPriority = Math.min(existing.displayPriority, priority);
				continue;
			}
			byId.set(provider.provider_id, {
				id: provider.provider_id,
				name: provider.provider_name,
				logoUrl: provider.logo_path ? LOGO_BASE_URL + provider.logo_path : null,
				displayPriority: priority,
			});
		}

		const services = [...byId.values()].sort(
			(a, b) =>
				a.displayPriority - b.displayPriority || a.name.localeCompare(b.name),
		);
		return { country: region, services };
	}

	private async fetchList(
		kind: "movie" | "tv",
		region: string,
	): Promise<TmdbProvider[]> {
		const response = await this.http.fetchCached(
			`${TMDB_BASE_URL}/watch/providers/${kind}?api_key=${this.tmdbApiKey}&watch_region=${region}`,
			`watchProviders:list:${kind}:${region}`,
			TMDB_DETAIL_CACHE_TTL_MS,
		);
		if (!response.ok) {
			this.logger.warn(
				`Failed to fetch ${kind} streaming services for ${region}`,
			);
			throw tmdbErrorForResponse(
				response,
				"Failed to fetch streaming services",
			);
		}
		const data = await response.json<TmdbProviderListResponse>();
		return data.results ?? [];
	}
}

/** Uppercase two-letter code; anything else falls back to the schema default. */
export function normalizeCountry(country: string | undefined): string {
	const trimmed = (country ?? "").trim().toUpperCase();
	return /^[A-Z]{2}$/.test(trimmed) ? trimmed : "US";
}
