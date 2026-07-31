/**
 * Pure Trakt payload → DTO mapping. No Nest, no Prisma, no network: everything
 * here is a plain function over an untrusted JSON payload, so it can be tested
 * without booting a module.
 */
import type {
	ImportSkipDto,
	NormalizedImportItemDto,
	TraktHistoryPreviewItemDto,
	TraktPublicProfileDto,
} from "./dto/import-history.dto";

export type TraktProfilePayload = {
	username?: unknown;
	name?: unknown;
	private?: unknown;
	vip?: unknown;
	ids?: {
		slug?: unknown;
	};
	images?: {
		avatar?: {
			full?: unknown;
			medium?: unknown;
			thumb?: unknown;
		};
	};
};

export type TraktHistoryPayloadItem = {
	type?: unknown;
	action?: unknown;
	watched_at?: unknown;
	movie?: {
		title?: unknown;
		year?: unknown;
		ids?: {
			tmdb?: unknown;
			trakt?: unknown;
			slug?: unknown;
			imdb?: unknown;
		};
	};
	show?: {
		title?: unknown;
		year?: unknown;
		ids?: {
			tmdb?: unknown;
			trakt?: unknown;
			slug?: unknown;
			imdb?: unknown;
		};
	};
	episode?: {
		season?: unknown;
		number?: unknown;
		title?: unknown;
	};
};

export const TRAKT_PREVIEW_ITEM_LIMIT = 5;

const ALLOWED_TRAKT_ACTIONS = new Set(["watch", "scrobble", "checkin"]);

export function getStringValue(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getOptionalStringValue(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export function getOptionalIntegerValue(value: unknown): number | undefined {
	return typeof value === "number" && Number.isInteger(value)
		? value
		: undefined;
}

export function getOptionalIdentifierValue(value: unknown): string | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return getOptionalStringValue(value);
}

export function resolveTraktAvatarUrl(
	avatar:
		| {
				full?: unknown;
				medium?: unknown;
				thumb?: unknown;
		  }
		| undefined,
): string | undefined {
	const candidate =
		getOptionalStringValue(avatar?.full) ??
		getOptionalStringValue(avatar?.medium) ??
		getOptionalStringValue(avatar?.thumb);

	if (!candidate) {
		return undefined;
	}

	if (candidate.startsWith("//")) {
		return `https:${candidate}`;
	}

	if (candidate.startsWith("http://")) {
		return `https://${candidate.slice("http://".length)}`;
	}

	return candidate;
}

export function buildMovieSubtitle(year: unknown): string {
	if (typeof year === "number" && Number.isInteger(year) && year > 1800) {
		return `Movie • ${year}`;
	}
	return "Movie";
}

export function buildEpisodeSubtitle(
	seasonNumber: number,
	episodeNumber: number,
	episodeTitle: unknown,
): string {
	const episodeCode = `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
	const title = getOptionalStringValue(episodeTitle);
	return title ? `${episodeCode} • ${title}` : episodeCode;
}

export function yearFromDate(value?: string): number | undefined {
	if (!value) return undefined;
	const year = Number.parseInt(value.slice(0, 4), 10);
	return Number.isInteger(year) ? year : undefined;
}

export function candidateYearScore(
	value: string | undefined,
	sourceYear: number | null,
): number {
	if (!sourceYear) return 0;
	return yearFromDate(value) === sourceYear ? 1 : 0;
}

export function mapTraktProfilePayload(
	profile: TraktProfilePayload,
	fallbackUsername: string,
): TraktPublicProfileDto {
	return {
		username: getStringValue(profile.username, fallbackUsername),
		slug: getStringValue(profile.ids?.slug, fallbackUsername),
		name: getOptionalStringValue(profile.name),
		isPrivate: profile.private === true,
		isVip: profile.vip === true,
		avatarUrl: resolveTraktAvatarUrl(profile.images?.avatar),
	};
}

/** Stable identity for a watch, used to dedupe within and across pages. */
export function buildImportKey(item: NormalizedImportItemDto): string {
	if (item.type === "movie") {
		return `movie:${item.movieTmdbId}:${item.watchedAt}`;
	}
	return `episode:${item.showTmdbId}:${item.seasonNumber}:${item.episodeNumber}:${item.watchedAt}`;
}

/** Log-friendly one-liner for a normalized item. */
export function describeImportItem(item: NormalizedImportItemDto): string {
	const watchedAt = item.watchedAt;
	const action = item.action ?? "watch";

	if (item.type === "movie") {
		return `movie tmdb=${item.movieTmdbId ?? "unknown"}, watchedAt=${watchedAt}, action=${action}`;
	}

	return `episode showTmdb=${item.showTmdbId ?? "unknown"}, season=${item.seasonNumber ?? "unknown"}, episode=${item.episodeNumber ?? "unknown"}, watchedAt=${watchedAt}, action=${action}`;
}

export function normalizeTraktApiItem(
	rawItem: unknown,
	index: number,
): {
	item?: NormalizedImportItemDto;
	skip?: ImportSkipDto;
	previewItem?: TraktHistoryPreviewItemDto;
} {
	if (!rawItem || typeof rawItem !== "object") {
		return {
			skip: {
				index,
				reason: "unsupported_type",
				message: "Invalid item format",
			},
		};
	}

	const item = rawItem as TraktHistoryPayloadItem;
	const action =
		typeof item.action === "string" ? (item.action as string) : "watch";
	if (!ALLOWED_TRAKT_ACTIONS.has(action)) {
		return {
			skip: {
				index,
				reason: "unsupported_action",
				message: `Unsupported action: ${String(item.action ?? "unknown")}`,
			},
		};
	}

	const normalizedAction = action as "watch" | "scrobble" | "checkin";
	if (
		typeof item.watched_at !== "string" ||
		Number.isNaN(Date.parse(item.watched_at))
	) {
		return {
			skip: {
				index,
				reason: "invalid_watched_at",
				message: "Missing or invalid watched_at timestamp",
			},
		};
	}

	const watchedAt = new Date(item.watched_at).toISOString();

	if (item.type === "movie") {
		const tmdbId = item.movie?.ids?.tmdb;
		if (typeof tmdbId !== "number" || !Number.isInteger(tmdbId) || tmdbId < 1) {
			return {
				skip: {
					index,
					reason: "missing_tmdb_id",
					message: "Movie item is missing a TMDB id",
				},
			};
		}

		return {
			item: {
				type: "movie",
				movieTmdbId: tmdbId,
				action: normalizedAction,
				watchedAt,
			},
			previewItem: {
				type: "movie",
				title: getStringValue(item.movie?.title, "Untitled movie"),
				subtitle: buildMovieSubtitle(item.movie?.year),
				watchedAt,
			},
		};
	}

	if (item.type === "episode") {
		const tmdbId = item.show?.ids?.tmdb;
		const seasonNumber = item.episode?.season;
		const episodeNumber = item.episode?.number;

		if (typeof tmdbId !== "number" || !Number.isInteger(tmdbId) || tmdbId < 1) {
			return {
				skip: {
					index,
					reason: "missing_tmdb_id",
					message: "Episode item is missing a show TMDB id",
				},
			};
		}

		if (
			typeof seasonNumber !== "number" ||
			typeof episodeNumber !== "number" ||
			!Number.isInteger(seasonNumber) ||
			!Number.isInteger(episodeNumber) ||
			seasonNumber < 0 ||
			episodeNumber < 1
		) {
			return {
				skip: {
					index,
					reason: "missing_episode_ref",
					message: "Episode item is missing season and episode numbers",
				},
			};
		}

		return {
			item: {
				type: "episode",
				showTmdbId: tmdbId,
				seasonNumber,
				episodeNumber,
				action: normalizedAction,
				watchedAt,
			},
			previewItem: {
				type: "episode",
				title: getStringValue(item.show?.title, "Untitled show"),
				subtitle: buildEpisodeSubtitle(
					seasonNumber,
					episodeNumber,
					item.episode?.title,
				),
				watchedAt,
			},
		};
	}

	return {
		skip: {
			index,
			reason: "unsupported_type",
			message: `Unsupported item type: ${String(item.type ?? "unknown")}`,
		},
	};
}

export function normalizeTraktPage(
	payload: unknown[],
	startIndex: number,
): {
	items: NormalizedImportItemDto[];
	skipped: ImportSkipDto[];
	previewItems: TraktHistoryPreviewItemDto[];
} {
	const items: NormalizedImportItemDto[] = [];
	const skipped: ImportSkipDto[] = [];
	const previewItems: TraktHistoryPreviewItemDto[] = [];

	for (let index = 0; index < payload.length; index++) {
		const result = normalizeTraktApiItem(payload[index], startIndex + index);
		if (result.item) {
			items.push(result.item);
			if (
				result.previewItem &&
				previewItems.length < TRAKT_PREVIEW_ITEM_LIMIT
			) {
				previewItems.push(result.previewItem);
			}
		} else if (result.skip) {
			skipped.push(result.skip);
		}
	}

	return { items, skipped, previewItems };
}
