import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
	TraktHistoryPreviewItemDto,
	TraktPublicProfileDto,
} from "./dto/import-history.dto";
import { TraktApiError } from "./import-errors";
import {
	mapTraktProfilePayload,
	normalizeTraktPage,
	type TraktProfilePayload,
} from "./trakt-normalize";

export const TRAKT_HISTORY_PAGE_SIZE = 100;

/**
 * Everything that talks to api.trakt.tv. Kept apart from the import pipeline so
 * the pipeline only deals in payloads and TraktApiError, never in URLs, headers
 * or status codes.
 */
@Injectable()
export class TraktApiClient {
	private readonly traktApiKey: string;
	private readonly traktBaseUrl = "https://api.trakt.tv";
	private readonly traktUserAgent = "Opnshelf/1.0 (+https://opnshelf.xyz)";

	constructor(private readonly configService: ConfigService) {
		this.traktApiKey = this.configService.get<string>("TRAKT_API_KEY") ?? "";
	}

	/** Throws when the server has no Trakt API key, so callers fail fast. */
	ensureConfigured(): void {
		if (!this.traktApiKey) {
			throw new BadRequestException(
				"Trakt import is not configured on this server. You can still import via CSV.",
			);
		}
	}

	normalizeUsername(username: string): string {
		const normalizedUsername = username.trim();
		if (!normalizedUsername) {
			throw new BadRequestException("Trakt username is required");
		}
		return normalizedUsername;
	}

	async fetchPublicProfile(username: string): Promise<TraktPublicProfileDto> {
		const url = this.createUrl(
			`/users/${encodeURIComponent(username)}?extended=full`,
		);
		const payload = await this.fetchJson<unknown>(url);

		if (!payload || typeof payload !== "object") {
			throw new BadRequestException("Unexpected Trakt profile format");
		}

		return mapTraktProfilePayload(payload as TraktProfilePayload, username);
	}

	async fetchHistoryPage(
		username: string,
		page: number,
		options?: { startAt?: Date; endAt?: Date },
	): Promise<{ payload: unknown[]; pageCount?: number }> {
		const url = this.createUrl(
			`/users/${encodeURIComponent(username)}/history`,
		);
		url.searchParams.set("page", String(page));
		url.searchParams.set("limit", String(TRAKT_HISTORY_PAGE_SIZE));
		if (options?.startAt) {
			url.searchParams.set("start_at", options.startAt.toISOString());
		}
		if (options?.endAt) {
			url.searchParams.set("end_at", options.endAt.toISOString());
		}

		const { data, headers } = await this.fetchJsonWithHeaders<unknown>(url);
		if (!Array.isArray(data)) {
			throw new BadRequestException("Unexpected Trakt response format");
		}

		return {
			payload: data,
			pageCount: parsePaginationPageCount(headers),
		};
	}

	/** Profile plus the first page, used to show the user what they're about to import. */
	async fetchPreview(username: string): Promise<{
		profile: TraktPublicProfileDto;
		previewItems: TraktHistoryPreviewItemDto[];
		sourcePreviewCount: number;
	}> {
		const profile = await this.fetchPublicProfile(username);
		const pageResult = await this.fetchHistoryPage(username, 1);
		const normalized = normalizeTraktPage(pageResult.payload, 1);

		return {
			profile,
			previewItems: normalized.previewItems,
			sourcePreviewCount: pageResult.payload.length,
		};
	}

	private createUrl(pathname: string): URL {
		return new URL(pathname, this.traktBaseUrl);
	}

	private async fetchJson<T>(url: URL): Promise<T> {
		const { data } = await this.fetchJsonWithHeaders<T>(url);
		return data;
	}

	private async fetchJsonWithHeaders<T>(
		url: URL,
	): Promise<{ data: T; headers: Headers }> {
		const response = await fetch(url.toString(), {
			headers: {
				"trakt-api-key": this.traktApiKey,
				"trakt-api-version": "2",
				"User-Agent": this.traktUserAgent,
			},
			signal: AbortSignal.timeout(12_000),
		});

		if (response.status === 404) {
			throw new TraktApiError("Trakt user not found", 404);
		}
		if (response.status === 401 || response.status === 403) {
			throw new TraktApiError(
				"Trakt profile is private or unavailable. Try CSV import instead.",
				response.status,
			);
		}
		if (response.status === 429) {
			throw new TraktApiError(
				"Trakt rate limit reached. We will retry in the background shortly.",
				429,
				parseRetryAfterSeconds(response.headers),
			);
		}
		if (response.status >= 500) {
			throw new TraktApiError(
				"Trakt is temporarily unavailable. Please retry later or use CSV import.",
				response.status,
			);
		}
		if (!response.ok) {
			throw new TraktApiError(
				"Failed to fetch Trakt public history",
				response.status,
			);
		}

		return {
			data: (await response.json()) as T,
			headers: response.headers ?? new Headers(),
		};
	}
}

function parsePaginationPageCount(headers: Headers): number | undefined {
	return parsePositiveIntHeader(headers, "x-pagination-page-count");
}

function parseRetryAfterSeconds(headers: Headers): number | undefined {
	return parsePositiveIntHeader(headers, "retry-after");
}

function parsePositiveIntHeader(
	headers: Headers,
	name: string,
): number | undefined {
	const rawValue = headers.get(name);
	if (!rawValue) {
		return undefined;
	}

	const parsed = Number.parseInt(rawValue, 10);
	if (!Number.isInteger(parsed) || parsed < 1) {
		return undefined;
	}

	return parsed;
}
