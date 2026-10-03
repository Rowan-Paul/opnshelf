import {
	Inject,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { BackendEnv } from "../config/env.schema";
import { TMDB_CACHE_STORE } from "../tmdb/tmdb-cache.module";
import type { TmdbCacheStore } from "../tmdb/tmdb-cache.store";
import {
	TMDB_BASE_URL,
	TMDB_DETAIL_CACHE_TTL_MS,
	TmdbHttpClient,
} from "../tmdb/tmdb-http";

export type FeaturedMedia = {
	mediaType: string;
	mediaId: number;
	seasonNumber?: number | null;
};
@Injectable()
export class FeaturedCatalogService {
	private readonly http: TmdbHttpClient;
	constructor(
		private readonly config: BackendEnv,
		@Inject(TMDB_CACHE_STORE) cache: TmdbCacheStore,
	) {
		this.http = new TmdbHttpClient(
			config.TMDB_API_KEY ?? "",
			FeaturedCatalogService.name,
			cache,
		);
	}
	private async details(
		path: string,
	): Promise<{ title?: string; name?: string; poster_path?: string | null }> {
		const url = `${TMDB_BASE_URL}${path}?api_key=${this.config.TMDB_API_KEY ?? ""}&language=en-US`;
		const response = await this.http.fetchCached(
			url,
			url,
			TMDB_DETAIL_CACHE_TTL_MS,
		);
		// Only a real 404 proves the title is missing; authentication/limits/outages do not.
		if (response.status === 404)
			throw new NotFoundException("Catalog title no longer exists");
		if (!response.ok)
			throw new ServiceUnavailableException(
				"Catalog is temporarily unavailable",
			);
		return response.json();
	}
	async resolve(media: FeaturedMedia) {
		const item = await this.details(
			`/${media.mediaType === "movie" ? "movie" : "tv"}/${media.mediaId}`,
		);
		const season =
			media.mediaType === "season"
				? await this.details(
						`/tv/${media.mediaId}/season/${media.seasonNumber}`,
					)
				: null;
		const title = item.title || item.name;
		if (!title)
			throw new ServiceUnavailableException("Catalog title is incomplete");
		return {
			title,
			posterPath: season?.poster_path ?? item.poster_path ?? null,
		};
	}
}
