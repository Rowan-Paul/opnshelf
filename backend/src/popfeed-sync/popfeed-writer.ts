import { contentValue } from "../integrations/content-value";
import { IntegrationError } from "../integrations/integration-error";
import { listValue, memberKey } from "../integrations/list-value";
import type { SyncRecord } from "../integrations/reconcile";
import {
	LIST,
	LIST_ITEM,
	type PopfeedRecord,
	type PopfeedRepository,
	popfeedRecords,
	REVIEW,
} from "./popfeed-records";

/** TMDB details Popfeed records carry alongside their identifiers. */
export type PopfeedMedia = {
	title: string;
	releaseDate?: string;
	genres: string[];
	mainCredit?: string;
	posterPath?: string;
	backdropPath?: string;
};

export interface PopfeedRepo {
	/** A fresh read of the three Popfeed collections. */
	read(): Promise<PopfeedRepository>;
	create(collection: string, record: Record<string, unknown>): Promise<string>;
	put(uri: string, record: Record<string, unknown>): Promise<void>;
	remove(uri: string): Promise<void>;
	/** Upload a TMDB poster as a blob, or nothing when it cannot be fetched. */
	poster(posterPath: string): Promise<unknown | undefined>;
}

export interface PopfeedMediaLookup {
	media(type: "movie" | "show", tmdbId: string): Promise<PopfeedMedia>;
}

type Raw = Record<string, unknown> & {
	creativeWorkType?: string;
	listType?: string;
	listUri?: string;
	identifiers?: { tmdbId?: string };
	watchedEpisodes?: {
		seasonNumber: number;
		episodeNumber: number;
		tmdbId?: string;
	}[];
	rating?: number;
	text?: string;
	createdAt?: string;
};

const POSTER = "https://image.tmdb.org/t/p/w500";
const BACKDROP = "https://image.tmdb.org/t/p/original";
const WATCHED_MOVIES = "watched_movies";
const MOVIE_WATCHLIST = "movie_watchlist";
const CURRENTLY_WATCHING = "currently_watching_tv_shows";

// Popfeed reads midnight UTC as a date without a time. A Watch at exactly
// midnight keeps its time by moving one millisecond.
const addedAt = (value: string) => {
	const iso = new Date(value).toISOString();
	return iso.endsWith("T00:00:00.000Z") ? iso.replace(/\.000Z$/, ".001Z") : iso;
};
/** Popfeed cannot hold this record. The sync loop keeps it in Needs attention. */
const unrepresentable = (message: string) => new IntegrationError(message, 422);

const raw = (record: PopfeedRecord) => record.value as Raw;
const tmdbOf = (record: PopfeedRecord) => raw(record).identifiers?.tmdbId;
const uriOf = (key: string, prefix: string) =>
	key.startsWith(prefix) ? key.slice(prefix.length) : undefined;

/**
 * Writes Opnshelf changes as Popfeed records. Popfeed publishes no lexicon, so
 * new records copy the shape of records Popfeed itself writes, and updates keep
 * every field this writer does not own (docs/prd/popfeed-interop.md).
 */
export class PopfeedWriter {
	constructor(
		private readonly repo: PopfeedRepo,
		private readonly lookup: PopfeedMediaLookup,
		private readonly timeZone: string,
		private readonly now: () => Date = () => new Date(),
	) {}

	async write(
		record: SyncRecord,
		remove = false,
		previous?: SyncRecord | null,
		onCreated?: (record: SyncRecord) => Promise<void>,
	): Promise<void> {
		const repo = await this.repo.read();
		if (record.kind === "watch")
			return record.mediaType === "episode"
				? this.writeEpisode(repo, record, remove)
				: this.writeMovieWatch(repo, record, remove);
		if (record.kind === "rating") return this.writeRating(repo, record, remove);
		if (record.kind === "review")
			return this.writeReview(repo, record, remove, previous, onCreated);
		if (record.kind === "list")
			return this.writeList(repo, record, remove, onCreated);
		if (record.kind === "watchlist") return this.writeWatchlist(repo, record);
		throw unrepresentable(`Popfeed has no ${record.kind} records.`);
	}

	private async fields(
		type: "movie" | "show",
		tmdbId: string | null,
		identifiers: Record<string, unknown> = {},
	): Promise<Record<string, unknown>> {
		if (!tmdbId) throw unrepresentable("Choose a TMDB match for this title.");
		const media = await this.lookup.media(type, tmdbId);
		const poster = media.posterPath
			? await this.repo.poster(media.posterPath)
			: undefined;
		return {
			creativeWorkType: type === "movie" ? "movie" : "tv_show",
			identifiers: { tmdbId, ...identifiers },
			title: media.title,
			genres: media.genres,
			...(media.releaseDate
				? { releaseDate: `${media.releaseDate}T00:00:00.000Z` }
				: {}),
			...(media.mainCredit
				? {
						mainCredit: media.mainCredit,
						mainCreditRole: type === "movie" ? "director" : "creator",
					}
				: {}),
			...(media.posterPath
				? { posterUrl: `${POSTER}${media.posterPath}` }
				: {}),
			...(media.backdropPath
				? { backdropUrl: `${BACKDROP}${media.backdropPath}` }
				: {}),
			...(poster ? { poster } : {}),
		};
	}

	/** The list record holding a Popfeed system list, created like Popfeed does. */
	private async systemList(
		repo: PopfeedRepository,
		listType: string,
		name: string,
	): Promise<string> {
		const list = repo.lists.find((record) => raw(record).listType === listType);
		if (list) return list.uri;
		// Older Popfeed accounts have the items but no list record for the role.
		const item = repo.listItems.find(
			(record) =>
				raw(record).listType === listType &&
				typeof raw(record).listUri === "string",
		);
		if (item) return raw(item).listUri as string;
		return this.repo.create(LIST, {
			$type: LIST,
			name,
			description: "",
			listType,
			ordered: false,
			tags: [],
			createdAt: this.now().toISOString(),
		});
	}

	private async writeMovieWatch(
		repo: PopfeedRepository,
		record: SyncRecord,
		remove: boolean,
	) {
		if (remove) {
			const uri = uriOf(record.key, "watch:");
			if (!uri) throw unrepresentable("This Watch is not a Popfeed record.");
			return this.repo.remove(uri);
		}
		if (typeof record.value !== "string")
			throw unrepresentable(
				"Popfeed needs a watch date for a movie. Add a date to this Watch in Opnshelf.",
			);
		if (
			repo.listItems.some(
				(item) =>
					raw(item).listType === WATCHED_MOVIES &&
					tmdbOf(item) === record.mediaId,
			)
		)
			throw unrepresentable(
				"Popfeed keeps one watched entry per movie, so it cannot hold this rewatch. Your Opnshelf Watch is preserved.",
			);
		const listUri = await this.systemList(
			repo,
			WATCHED_MOVIES,
			"Watched Movies",
		);
		await this.repo.create(LIST_ITEM, {
			$type: LIST_ITEM,
			...(await this.fields("movie", record.mediaId)),
			listUri,
			listType: WATCHED_MOVIES,
			addedAt: addedAt(record.value),
		});
	}

	private async writeEpisode(
		repo: PopfeedRepository,
		record: SyncRecord,
		remove: boolean,
	) {
		const shows = repo.listItems.filter(
			(item) =>
				raw(item).creativeWorkType === "tv_show" &&
				tmdbOf(item) === record.mediaId,
		);
		const matches = (ep: { seasonNumber: number; episodeNumber: number }) =>
			ep.seasonNumber === record.season && ep.episodeNumber === record.episode;
		if (remove) {
			for (const show of shows) {
				const episodes = raw(show).watchedEpisodes ?? [];
				if (episodes.some(matches))
					await this.repo.put(show.uri, {
						...raw(show),
						watchedEpisodes: episodes.filter((ep) => !matches(ep)),
					});
			}
			return;
		}
		if (shows.some((show) => (raw(show).watchedEpisodes ?? []).some(matches)))
			throw unrepresentable(
				"Popfeed marks each episode watched once, so it cannot hold this rewatch. Your Opnshelf Watch is preserved.",
			);
		const episode = {
			seasonNumber: record.season,
			episodeNumber: record.episode,
		};
		const [show] = shows;
		if (show)
			return this.repo.put(show.uri, {
				...raw(show),
				watchedEpisodes: [...(raw(show).watchedEpisodes ?? []), episode],
			});
		const listUri = await this.systemList(
			repo,
			CURRENTLY_WATCHING,
			"Currently Watching Shows",
		);
		await this.repo.create(LIST_ITEM, {
			$type: LIST_ITEM,
			...(await this.fields("show", record.mediaId)),
			listUri,
			addedAt: this.now().toISOString(),
			watchedEpisodes: [episode],
		});
	}

	private titleType(record: SyncRecord): "movie" | "show" {
		if (record.mediaType === "movie" || record.mediaType === "show")
			return record.mediaType;
		throw unrepresentable(
			"Popfeed Sync sends Ratings and Reviews of movies and shows only.",
		);
	}

	private reviewsFor(repo: PopfeedRepository, record: SyncRecord) {
		const type = this.titleType(record);
		return repo.reviews
			.filter(
				(review) =>
					raw(review).creativeWorkType ===
						(type === "movie" ? "movie" : "tv_show") &&
					tmdbOf(review) === record.mediaId,
			)
			.sort((a, b) =>
				String(raw(b).createdAt ?? "").localeCompare(
					String(raw(a).createdAt ?? ""),
				),
			);
	}

	private async writeRating(
		repo: PopfeedRepository,
		record: SyncRecord,
		remove: boolean,
	) {
		const rated = this.reviewsFor(repo, record).find(
			(review) => (raw(review).rating ?? 0) > 0,
		);
		if (remove) {
			if (!rated) return;
			// Popfeed requires a rating; 0 keeps a review's text without a score.
			if (raw(rated).text?.trim())
				return this.repo.put(rated.uri, { ...raw(rated), rating: 0 });
			return this.repo.remove(rated.uri);
		}
		if (rated)
			return this.repo.put(rated.uri, { ...raw(rated), rating: record.value });
		await this.repo.create(REVIEW, {
			$type: REVIEW,
			...(await this.fields(this.titleType(record), record.mediaId)),
			rating: record.value,
			text: "",
			facets: [],
			tags: [],
			isRevisit: false,
			containsSpoilers: false,
			createdAt: this.now().toISOString(),
		});
	}

	private async writeReview(
		repo: PopfeedRepository,
		record: SyncRecord,
		remove: boolean,
		previous?: SyncRecord | null,
		onCreated?: (record: SyncRecord) => Promise<void>,
	) {
		const uri = uriOf(previous?.key ?? record.key, "review:");
		const existing = uri
			? repo.reviews.find((review) => review.uri === uri)
			: undefined;
		if (remove) {
			if (!existing) return;
			// Keep the record when it also carries the title's Popfeed rating.
			if ((raw(existing).rating ?? 0) > 0)
				return this.repo.put(existing.uri, {
					...raw(existing),
					text: "",
					facets: [],
					containsSpoilers: false,
				});
			return this.repo.remove(existing.uri);
		}
		const value = contentValue(record);
		const text = {
			text: value.content,
			facets: [],
			containsSpoilers: value.spoiler,
		};
		if (existing)
			return this.repo.put(existing.uri, { ...raw(existing), ...text });
		const rating =
			raw(
				this.reviewsFor(repo, record).find(
					(review) => (raw(review).rating ?? 0) > 0,
				) ?? { uri: "", value: {} },
			).rating ?? 0;
		const created = await this.repo.create(REVIEW, {
			$type: REVIEW,
			...(await this.fields(this.titleType(record), record.mediaId)),
			rating,
			...text,
			tags: [],
			isRevisit: false,
			createdAt: record.createdAt ?? this.now().toISOString(),
		});
		await onCreated?.({ ...record, key: `review:${created}`, title: "" });
	}

	private member(item: PopfeedRecord) {
		const type = raw(item).creativeWorkType;
		return {
			mediaType: type === "movie" ? ("movie" as const) : ("show" as const),
			mediaId: tmdbOf(item) ?? null,
			season: 0,
			episode: 0,
			notes: "",
		};
	}

	/** Bring one Popfeed list's items in line with the desired members. */
	private async syncMembers(
		repo: PopfeedRepository,
		listUri: string,
		listType: string,
		members: ReturnType<typeof listValue>["items"],
	) {
		const items = repo.listItems.filter(
			(item) => raw(item).listUri === listUri,
		);
		const wanted = new Set(members.map(memberKey));
		const present = new Set<string>();
		for (const item of items) {
			// Items Opnshelf cannot match (no TMDB ID, or books and games) are
			// not Opnshelf's to remove; leave them on Popfeed.
			const type = raw(item).creativeWorkType;
			if (!tmdbOf(item) || (type !== "movie" && type !== "tv_show")) continue;
			const key = memberKey(this.member(item));
			if (wanted.has(key) && !present.has(key)) present.add(key);
			else await this.repo.remove(item.uri);
		}
		for (const member of members) {
			const key = memberKey(member);
			if (present.has(key)) continue;
			present.add(key);
			await this.repo.create(LIST_ITEM, {
				$type: LIST_ITEM,
				...(await this.fields(
					member.mediaType === "movie" ? "movie" : "show",
					member.mediaId,
				)),
				listUri,
				listType,
				addedAt: this.now().toISOString(),
			});
		}
	}

	private assertMembers(members: ReturnType<typeof listValue>["items"]) {
		const unsupported = members.filter(
			(member) =>
				(member.mediaType !== "movie" && member.mediaType !== "show") ||
				!member.mediaId,
		);
		if (unsupported.length)
			throw unrepresentable(
				`Popfeed Lists hold movies and shows. ${unsupported.length} ${unsupported.length === 1 ? "item" : "items"} in this List cannot be sent; the List is preserved.`,
			);
		if (members.some((member) => member.notes))
			throw unrepresentable(
				"Popfeed List items have no notes. Remove the notes in Opnshelf to send this List; no text was dropped.",
			);
	}

	private async writeList(
		repo: PopfeedRepository,
		record: SyncRecord,
		remove: boolean,
		onCreated?: (record: SyncRecord) => Promise<void>,
	) {
		const uri = uriOf(record.key, "list:");
		const existing = uri
			? repo.lists.find((list) => list.uri === uri)
			: undefined;
		if (remove) {
			if (!existing) return;
			for (const item of repo.listItems)
				if (raw(item).listUri === existing.uri)
					await this.repo.remove(item.uri);
			return this.repo.remove(existing.uri);
		}
		const value = listValue(record);
		this.assertMembers(value.items);
		const listUri = existing
			? existing.uri
			: await this.repo.create(LIST, {
					$type: LIST,
					name: value.name,
					description: value.description,
					listType: "default",
					ordered: false,
					tags: [],
					createdAt: this.now().toISOString(),
				});
		if (existing)
			await this.repo.put(existing.uri, {
				...raw(existing),
				name: value.name,
				description: value.description,
			});
		else await onCreated?.({ ...record, key: `list:${listUri}` });
		await this.syncMembers(repo, listUri, "default", value.items);
	}

	private async writeWatchlist(repo: PopfeedRepository, record: SyncRecord) {
		const value = listValue(record);
		this.assertMembers(value.items);
		if (value.items.some((member) => member.mediaType !== "movie"))
			throw unrepresentable(
				"Popfeed's watchlist holds movies only. Shows on your Opnshelf watchlist stay in Opnshelf.",
			);
		const listUri = await this.systemList(repo, MOVIE_WATCHLIST, "Watchlist");
		await this.syncMembers(repo, listUri, MOVIE_WATCHLIST, value.items);
	}

	/** A scoped read for confirming a write: every Popfeed record of that kind. */
	async read(kind: SyncRecord["kind"]): Promise<SyncRecord[]> {
		const types = {
			watches: kind === "watch",
			ratings: kind === "rating",
			reviews: kind === "review",
			lists: kind === "list",
			watchlist: kind === "watchlist",
		};
		return popfeedRecords(await this.repo.read(), types, this.timeZone);
	}
}
