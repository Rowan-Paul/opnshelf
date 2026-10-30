import { z } from "zod";
import type { SyncRecordTypes } from "../integrations/adapter";
import { encodeContent } from "../integrations/content-value";
import {
	encodeList,
	type ListMember,
	memberKey,
} from "../integrations/list-value";
import type { MediaType, SyncRecord } from "../integrations/reconcile";

/**
 * Popfeed publishes no lexicons. These schemas follow records observed in real
 * repositories (docs/prd/popfeed-interop.md) and accept anything else they carry.
 */
export const LIST_ITEM = "social.popfeed.feed.listItem";
export const REVIEW = "social.popfeed.feed.review";
export const LIST = "social.popfeed.feed.list";

const tmdbId = z
	.string()
	.regex(/^[1-9]\d{0,9}$/)
	.optional()
	.catch(undefined);
const identifiers = z
	.object({
		tmdbId,
		seasonNumber: z.number().int().nonnegative().optional().catch(undefined),
		episodeNumber: z.number().int().nonnegative().optional().catch(undefined),
	})
	.passthrough()
	.catch({});
const listItemSchema = z
	.object({
		creativeWorkType: z.string(),
		listType: z.string().optional(),
		listUri: z.string(),
		addedAt: z.string(),
		identifiers,
		title: z.string().optional(),
		watchedEpisodes: z
			.array(
				z.object({
					seasonNumber: z.number().int().nonnegative(),
					episodeNumber: z.number().int().positive(),
				}),
			)
			.optional()
			.catch(undefined),
	})
	.passthrough();
const reviewSchema = z
	.object({
		creativeWorkType: z.string(),
		identifiers,
		rating: z.number().int().min(0).max(10).optional().catch(undefined),
		text: z.string().optional(),
		facets: z.array(z.unknown()).optional().catch(undefined),
		containsSpoilers: z.boolean().optional(),
		createdAt: z.string(),
		title: z.string().optional(),
	})
	.passthrough();
const listSchema = z
	.object({
		name: z.string(),
		description: z.string().optional(),
		listType: z.string().optional(),
	})
	.passthrough();

export type PopfeedRecord = { uri: string; value: unknown };
export type PopfeedRepository = {
	listItems: PopfeedRecord[];
	reviews: PopfeedRecord[];
	lists: PopfeedRecord[];
};

const MIDNIGHT_UTC = /T00:00:00(\.0+)?Z$/;

/** Minutes the timezone is ahead of UTC at instant. */
function offsetMinutes(instant: number, timeZone: string): number {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
			.formatToParts(new Date(instant))
			.map((p) => [p.type, Number(p.value)]),
	);
	const local = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	);
	return Math.round((local - instant) / 60_000);
}

/**
 * Popfeed stores backdated logs as midnight UTC, which is a date, not a time.
 * Converting that instant would move it to the previous day west of UTC, so
 * keep the calendar date and use noon in the owner's timezone.
 */
export function watchDate(
	addedAt: string,
	timeZone: string,
): { value: string; dateOnly: boolean } | null {
	const instant = Date.parse(addedAt);
	if (!Number.isFinite(instant)) return null;
	if (!MIDNIGHT_UTC.test(addedAt))
		return { value: new Date(instant).toISOString(), dateOnly: false };
	const day = new Date(instant);
	const noonUtc = Date.UTC(
		day.getUTCFullYear(),
		day.getUTCMonth(),
		day.getUTCDate(),
		12,
	);
	const noon = noonUtc - offsetMinutes(noonUtc, timeZone) * 60_000;
	return { value: new Date(noon).toISOString(), dateOnly: true };
}

/** Popfeed review facets are Bluesky-style byte ranges; links become Markdown. */
export function reviewMarkdown(text: string, facets: unknown[] = []): string {
	const bytes = new TextEncoder().encode(text);
	const links = facets
		.flatMap((facet) => {
			const f = facet as {
				index?: { byteStart?: number; byteEnd?: number };
				features?: { $type?: string; uri?: string }[];
			};
			const uri = f.features?.find(
				(x) => x.$type === "app.bsky.richtext.facet#link",
			)?.uri;
			const start = f.index?.byteStart;
			const end = f.index?.byteEnd;
			return uri &&
				Number.isInteger(start) &&
				Number.isInteger(end) &&
				(start as number) < (end as number) &&
				(end as number) <= bytes.length
				? [{ uri, start: start as number, end: end as number }]
				: [];
		})
		.sort((a, b) => a.start - b.start);
	if (!links.length) return text;
	const decoder = new TextDecoder();
	let out = "";
	let at = 0;
	for (const link of links) {
		if (link.start < at) continue;
		out += decoder.decode(bytes.slice(at, link.start));
		const label = decoder.decode(bytes.slice(link.start, link.end));
		out += `[${label.replace(/[[\]]/g, "\\$&")}](${link.uri})`;
		at = link.end;
	}
	return out + decoder.decode(bytes.slice(at));
}

// Popfeed lists keep no member order; read them in one stable order.
const sorted = (members: ListMember[]) =>
	[...members].sort((a, b) => memberKey(a).localeCompare(memberKey(b)));

const titleType = (creativeWorkType: string): "movie" | "show" | null =>
	creativeWorkType === "movie"
		? "movie"
		: creativeWorkType === "tv_show"
			? "show"
			: null;

const parse = <T>(schema: z.ZodType<T>, record: PopfeedRecord) => {
	const result = schema.safeParse(record.value);
	return result.success ? result.data : null;
};

/** Map one consistent read of a User's Popfeed records to Integration records. */
export function popfeedRecords(
	repo: PopfeedRepository,
	types: SyncRecordTypes,
	timeZone: string,
): SyncRecord[] {
	const result: SyncRecord[] = [];
	const lists = new Map(
		repo.lists.flatMap((r) => {
			const list = parse(listSchema, r);
			return list ? [[r.uri, list] as const] : [];
		}),
	);
	const watchlist: ListMember[] = [];
	const episodes = new Set<string>();
	const custom = new Map<string, { members: ListMember[]; problem?: string }>();
	for (const raw of repo.listItems) {
		const item = parse(listItemSchema, raw);
		if (!item) continue;
		const type = titleType(item.creativeWorkType);
		const mediaId = item.identifiers.tmdbId ?? null;
		const title = item.title ?? "";
		const listType = item.listType ?? lists.get(item.listUri)?.listType;
		if (types.watches && type === "movie" && listType === "watched_movies") {
			const date = watchDate(item.addedAt, timeZone);
			result.push({
				key: `watch:${raw.uri}`,
				kind: "watch",
				mediaType: "movie",
				mediaId,
				season: 0,
				episode: 0,
				title,
				value: date?.value ?? null,
				...(date?.dateOnly ? { dateOnly: true } : {}),
				...(date ? {} : { problem: "Popfeed returned an invalid watch date." }),
			});
		}
		if (types.watches && type === "show")
			for (const ep of item.watchedEpisodes ?? []) {
				// A show can sit in several Popfeed Lists; each episode is one Watch.
				const key = `watch:episode:${mediaId ?? raw.uri}:${ep.seasonNumber}:${ep.episodeNumber}`;
				if (episodes.has(key)) continue;
				episodes.add(key);
				result.push({
					key,
					kind: "watch",
					mediaType: "episode",
					mediaId,
					season: ep.seasonNumber,
					episode: ep.episodeNumber,
					title,
					// Popfeed keeps watched episodes without dates.
					value: null,
					undated: true,
				});
			}
		const member = type && {
			mediaType: type,
			mediaId,
			season: 0,
			episode: 0,
			notes: "",
		};
		if (types.watchlist && listType === "movie_watchlist" && member)
			watchlist.push(member);
		if (types.lists && listType === "default" && lists.has(item.listUri)) {
			const entry = custom.get(item.listUri) ?? { members: [] };
			if (member) entry.members.push(member);
			else
				entry.problem =
					"This Popfeed List contains items Opnshelf cannot hold, such as books or games. The List is preserved on Popfeed.";
			custom.set(item.listUri, entry);
		}
	}
	if (types.watchlist)
		result.push({
			key: "watchlist:popfeed",
			kind: "watchlist",
			mediaType: "list",
			mediaId: null,
			title: "Watchlist",
			season: 0,
			episode: 0,
			value: encodeList({
				name: "Watchlist",
				description: "",
				items: sorted(watchlist),
			}),
			visibility: "public",
			unordered: true,
		});
	if (types.lists)
		for (const [uri, list] of lists) {
			if (list.listType !== "default") continue;
			const entry = custom.get(uri) ?? { members: [] };
			result.push({
				key: `list:${uri}`,
				kind: "list",
				mediaType: "list",
				mediaId: null,
				title: list.name,
				season: 0,
				episode: 0,
				value: encodeList({
					name: list.name,
					description: list.description ?? "",
					items: sorted(entry.members),
				}),
				visibility: "public",
				unordered: true,
				...(entry.problem ? { problem: entry.problem } : {}),
			});
		}
	const ratings = new Map<string, { record: SyncRecord; createdAt: number }>();
	for (const raw of repo.reviews) {
		const review = parse(reviewSchema, raw);
		if (!review) continue;
		const type = titleType(review.creativeWorkType);
		if (!type) continue;
		const season = review.identifiers.seasonNumber ?? 0;
		const episode = review.identifiers.episodeNumber ?? 0;
		const mediaType: MediaType =
			type === "movie"
				? "movie"
				: episode
					? "episode"
					: season
						? "season"
						: "show";
		const coordinates = {
			mediaType,
			mediaId: review.identifiers.tmdbId ?? null,
			season,
			episode,
			title: review.title ?? "",
		};
		const createdAt = Date.parse(review.createdAt);
		// Popfeed requires a rating; 0 has no Opnshelf meaning and creates none.
		if (types.ratings && review.rating) {
			const key = `rating:${mediaType}:${coordinates.mediaId}:${season}:${episode}`;
			const current = ratings.get(key);
			if (!current || createdAt > current.createdAt)
				ratings.set(key, {
					createdAt,
					record: {
						...coordinates,
						key,
						kind: "rating",
						value: review.rating,
					},
				});
		}
		if (types.reviews && review.text?.trim())
			result.push({
				...coordinates,
				key: `review:${raw.uri}`,
				kind: "review",
				// Popfeed reviews have no title of their own; theirs is the media title.
				title: "",
				value: encodeContent({
					content: reviewMarkdown(review.text, review.facets),
					spoiler: review.containsSpoilers ?? false,
				}),
				visibility: "public",
				createdAt: review.createdAt,
			});
	}
	for (const { record } of ratings.values()) result.push(record);
	return result;
}
