import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { BackendEnv } from "../config/env.schema";
import {
	isListRecord,
	type MediaType,
	type SyncRecord,
} from "../integrations/reconcile";

import type {
	IntegrationRemote,
	SyncRecordTypes,
} from "../integrations/adapter";
import { isContentRecord } from "../integrations/content-value";
import { IntegrationError } from "../integrations/integration-error";
import { snapshotContent, writeContent } from "./remote-content";
import { snapshotLists, writeList } from "./remote-lists";

const ids = z.object({
	trakt: z.number().int().positive(),
	tmdb: z.number().int().positive().nullish(),
});
const media = z.object({
	ids,
	title: z.string().optional(),
	season: z.number().int().optional(),
	number: z.number().int().optional(),
});
const rowSchema = z.object({
	id: z.number().int().positive().optional(),
	type: z.enum(["movie", "show", "season", "episode"]),
	watched_at: z.string().nullable().optional(),
	rating: z.number().int().min(1).max(10).optional(),
	movie: media.optional(),
	show: media.optional(),
	season: media.optional(),
	episode: media.optional(),
});
export const tokenSchema = z.object({
	access_token: z.string().min(1),
	refresh_token: z.string().min(1),
	expires_in: z.number().positive(),
	created_at: z.number().positive(),
});
export type TraktToken = z.infer<typeof tokenSchema>;
const oauthErrorSchema = z.object({
	error: z.enum([
		"invalid_request",
		"invalid_client",
		"invalid_grant",
		"unauthorized_client",
		"unsupported_grant_type",
		"invalid_scope",
		"access_denied",
		"server_error",
		"temporarily_unavailable",
	]),
});
type TraktResponseDiagnostics = {
	responseFormat: "json" | "html" | "other";
	oauthError?: string;
	cloudflare: boolean;
	challenge: boolean;
	cloudflareRay?: string;
};
export class TraktSyncError extends IntegrationError {
	constructor(
		message: string,
		status = 0,
		retrySeconds = 60,
		readonly diagnostics?: TraktResponseDiagnostics,
	) {
		super(message, status, retrySeconds);
	}
}

export function normalizeRemote(
	payload: unknown,
	kind: "watch" | "rating",
): SyncRecord {
	const row = rowSchema.parse(payload);
	const item = row[row.type];
	if (
		!item ||
		(kind === "watch" &&
			(!row.id ||
				row.watched_at === undefined ||
				!["movie", "episode"].includes(row.type)))
	)
		throw new TraktSyncError("Trakt returned an unsupported history item.");
	const parent = row.type === "movie" ? row.movie : row.show;
	let value: SyncRecord["value"] = null;
	if (kind === "rating") {
		if (!row.rating)
			throw new TraktSyncError("Trakt returned an invalid Rating.");
		value = row.rating;
	} else if (row.watched_at && row.watched_at !== "unknown") {
		if (!Number.isFinite(Date.parse(row.watched_at)))
			throw new TraktSyncError("Trakt returned an invalid watch date.");
		value = new Date(row.watched_at).toISOString();
	}
	return {
		key:
			kind === "watch"
				? `watch:${row.id}`
				: `rating:${row.type}:${item.ids.trakt}`,
		kind,
		mediaType: row.type,
		mediaId: parent?.ids.tmdb?.toString() ?? null,
		season: row.type === "season" ? (item.number ?? 0) : (item.season ?? 0),
		episode: row.type === "episode" ? (item.number ?? 0) : 0,
		title: parent?.title ?? item.title ?? `Trakt ${row.type} ${item.ids.trakt}`,
		value,
		remoteId: item.ids.trakt,
		remoteParentId: parent?.ids.trakt,
	};
}

@Injectable()
export class TraktSyncClient implements IntegrationRemote<string> {
	private readonly nextRequests = new Map<string, number>();
	constructor(private readonly config: BackendEnv) {}
	get configured() {
		return Boolean(this.config.TRAKT_API_KEY && this.config.BACKEND_PUBLIC_URL);
	}
	get callbackUrl() {
		return `${this.config.BACKEND_PUBLIC_URL}/trakt-sync/callback`;
	}
	get clientId() {
		return this.config.TRAKT_API_KEY ?? "";
	}

	async request(
		path: string,
		token?: string,
		body?: unknown,
		method = body === undefined ? "GET" : "POST",
	): Promise<{ data: unknown; headers: Headers }> {
		// Pace both reads and writes below Trakt's per-user limits. No credential logging.
		const now = Date.now();
		for (const [key, next] of this.nextRequests)
			if (next <= now) this.nextRequests.delete(key);
		const key = token
			? createHash("sha256").update(token).digest("hex")
			: "oauth";
		const next = this.nextRequests.get(key) ?? now;
		const delay = Math.max(0, next - now);
		this.nextRequests.set(key, Math.max(now, next) + 1100);
		if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
		const response = await fetch(`https://api.trakt.tv${path}`, {
			method,
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "Opnshelf/1.0 (+https://opnshelf.xyz)",
				"trakt-api-key": this.clientId,
				"trakt-api-version": "2",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(15_000),
		});
		if (!response.ok) {
			const retry = Number(response.headers.get("retry-after"));
			const contentType = response.headers.get("content-type") ?? "";
			let oauthError: string | undefined;
			if (contentType.includes("json")) {
				// Only retain known OAuth error codes, never descriptions or raw bodies.
				const parsed = oauthErrorSchema.safeParse(
					await response.json().catch(() => null),
				);
				oauthError = parsed.success ? parsed.data.error : undefined;
			}
			const ray = response.headers.get("cf-ray") ?? "";
			throw new TraktSyncError(
				response.status === 401
					? "Reconnect Trakt to continue syncing."
					: response.status === 429
						? "Trakt rate limit reached. Sync will retry."
						: response.status === 422 && path.startsWith("/comments")
							? "Trakt rejected this Review. Check its English-language, word-count and formatting requirements before retrying."
							: response.status === 420 && path.startsWith("/notes")
								? "Your Trakt Notes limit was reached. Free space on Trakt and retry; your Note is preserved."
								: response.status === 420 && path.startsWith("/sync/favorites")
									? "Your Trakt Favorites limit was reached. Free space and retry; no Favorites were truncated."
									: "Trakt could not complete the request. Sync will retry.",
				response.status,
				Number.isFinite(retry) && retry > 0 ? retry : 60,
				{
					responseFormat: contentType.includes("json")
						? "json"
						: contentType.includes("html")
							? "html"
							: "other",
					oauthError,
					cloudflare: response.headers.get("server") === "cloudflare",
					challenge: response.headers.get("cf-mitigated") === "challenge",
					cloudflareRay: /^[a-f0-9]{16,32}-[A-Z]{3}$/i.test(ray)
						? ray
						: undefined,
				},
			);
		}
		const text = await response.text();
		return {
			data: text.trim() ? JSON.parse(text) : null,
			headers: response.headers,
		};
	}

	async exchange(code: string, verifier: string): Promise<TraktToken> {
		return tokenSchema.parse(
			(
				await this.request("/oauth/token", undefined, {
					client_id: this.clientId,
					redirect_uri: this.callbackUrl,
					code,
					code_verifier: verifier,
					grant_type: "authorization_code",
				})
			).data,
		);
	}
	async refresh(refreshToken: string): Promise<TraktToken> {
		return tokenSchema.parse(
			(
				await this.request("/oauth/token", undefined, {
					client_id: this.clientId,
					redirect_uri: this.callbackUrl,
					refresh_token: refreshToken,
					grant_type: "refresh_token",
				})
			).data,
		);
	}
	async revoke(token: string) {
		await this.request("/oauth/revoke", undefined, {
			token,
			client_id: this.clientId,
		});
	}
	async profile(token: string) {
		return z
			.object({
				user: z.object({
					username: z.string(),
					ids: z.object({ uuid: z.string().min(1) }),
				}),
			})
			.parse((await this.request("/users/settings", token)).data).user;
	}
	async snapshot(
		token: string,
		options: SyncRecordTypes = {},
	): Promise<SyncRecord[]> {
		const before = (await this.request("/sync/last_activities", token)).data;
		const watches =
			options.watches === false
				? []
				: await this.pages("/sync/history", token, "watch");
		const ratings: SyncRecord[] = [];
		for (const type of options.ratings === false
			? []
			: ["movies", "shows", "seasons", "episodes"])
			ratings.push(
				...(await this.pages(`/sync/ratings/${type}`, token, "rating")),
			);
		const lists =
			options.lists || options.watchlist || options.favorites
				? await snapshotLists(this, token, options)
				: [];
		const content =
			options.notes || options.library || options.reviews
				? await snapshotContent(this, token, options)
				: [];
		const after = (await this.request("/sync/last_activities", token)).data;
		if (JSON.stringify(before) !== JSON.stringify(after))
			throw new TraktSyncError(
				"Trakt changed during the read. Sync will read a fresh snapshot.",
			);
		return [...watches, ...ratings, ...lists, ...content];
	}
	/** Confirm only the affected title's Watches, or the affected Rating category.
	 * Ratings have no item-ID filter: the final path segment filters rating value. */
	async readForRecord(
		token: string,
		record: SyncRecord,
	): Promise<SyncRecord[]> {
		if (isContentRecord(record))
			return snapshotContent(this, token, {
				notes: record.kind === "note",
				library: record.kind === "library",
				reviews: record.kind === "review",
			});
		if (isListRecord(record))
			return snapshotLists(this, token, {
				lists: record.kind === "list",
				listId: record.remoteId,
				watchlist: record.kind === "watchlist",
				favorites: record.kind === "favorites",
			});
		const plural = `${record.mediaType}s`;
		if (record.kind === "rating")
			return this.pages(`/sync/ratings/${plural}`, token, "rating");
		let remoteId = record.remoteId;
		if (!remoteId) {
			if (!record.mediaId)
				throw new TraktSyncError("Choose a matching title first.");
			const type = record.mediaType === "movie" ? "movie" : "show";
			const { data } = await this.request(
				`/search/tmdb/${encodeURIComponent(record.mediaId)}?type=${type}`,
				token,
			);
			const matches = z
				.array(
					z.object({
						type: z.string(),
						movie: media.optional(),
						show: media.optional(),
					}),
				)
				.parse(data)
				.filter(
					(row) =>
						row.type === type &&
						row[type]?.ids.tmdb?.toString() === record.mediaId,
				);
			if (matches.length !== 1)
				throw new TraktSyncError(
					"Trakt could not uniquely identify the written title.",
				);
			remoteId = matches[0][type]?.ids.trakt;
			if (record.mediaType === "episode") {
				const episode = await this.request(
					`/shows/${remoteId}/seasons/${record.season}/episodes/${record.episode}`,
					token,
				);
				remoteId = media.parse(episode.data).ids.trakt;
			}
		}
		if (!remoteId)
			throw new TraktSyncError("Trakt did not return a title identity.");
		return this.pages(`/sync/history/${plural}/${remoteId}`, token, "watch");
	}

	async pages(
		path: string,
		token: string,
		kind: "watch" | "rating",
	): Promise<SyncRecord[]> {
		const result: SyncRecord[] = [];
		const seen = new Set<string>();
		// Trakt can serve a stale item count on earlier pages; the last page's
		// count is the one that matches the rows actually returned.
		let expectedCount: number | undefined;
		for (let page = 1; ; page++) {
			const { data, headers } = await this.request(
				`${path}?page=${page}&limit=100`,
				token,
			);
			const rows = z.array(z.unknown()).parse(data);
			const pages = Number(headers.get("x-pagination-page-count"));
			const countHeader = headers.get("x-pagination-item-count");
			const count = countHeader === null ? undefined : Number(countHeader);
			expectedCount = count;
			if (
				count === undefined ||
				!Number.isInteger(count) ||
				count < 0 ||
				!Number.isInteger(pages) ||
				pages < 0 ||
				headers.get("x-pagination-page-count") === null
			)
				throw new TraktSyncError(
					"Trakt pagination was incomplete. No removals were applied.",
				);
			for (const row of rows) {
				const record = normalizeRemote(row, kind);
				if (seen.has(record.key))
					throw new TraktSyncError(
						"Trakt history changed while reading. No removals were applied.",
					);
				seen.add(record.key);
				result.push(record);
			}
			if (page >= pages) break;
			if (rows.length === 0)
				throw new TraktSyncError("Trakt returned an incomplete page.");
		}
		if (expectedCount !== undefined && expectedCount !== result.length)
			throw new TraktSyncError("Trakt returned incomplete results.");
		return result;
	}
	async write(
		token: string,
		record: SyncRecord,
		remove = false,
		previous?: SyncRecord | null,
		onCreated?: (record: SyncRecord) => Promise<void>,
	) {
		if (isContentRecord(record))
			return writeContent(this, token, record, remove, previous, onCreated);
		if (isListRecord(record))
			return writeList(this, token, record, remove, previous, onCreated);
		if (record.kind === "watch" && remove) {
			const id = Number(record.key.slice("watch:".length));
			if (!Number.isSafeInteger(id) || id < 1)
				throw new TraktSyncError("Missing Trakt Watch identity.");
			await this.request("/sync/history/remove", token, { ids: [id] });
			return;
		}
		const props =
			record.kind === "watch"
				? { watched_at: record.value ?? "unknown" }
				: remove
					? {}
					: { rating: record.value };
		let body: unknown;
		if (record.remoteId) {
			const plural: Record<MediaType, string> = {
				movie: "movies",
				show: "shows",
				season: "seasons",
				episode: "episodes",
				list: "lists",
			};
			body = {
				[plural[record.mediaType]]: [
					{ ids: { trakt: record.remoteId }, ...props },
				],
			};
		} else {
			if (!record.mediaId)
				throw new TraktSyncError("Choose a matching title first.");
			const item = { ids: { tmdb: Number(record.mediaId) }, ...props };
			body =
				record.mediaType === "movie"
					? { movies: [item] }
					: record.mediaType === "show"
						? { shows: [item] }
						: {
								shows: [
									{
										ids: item.ids,
										seasons: [
											{
												number: record.season,
												...(record.mediaType === "season"
													? props
													: {
															episodes: [{ number: record.episode, ...props }],
														}),
											},
										],
									},
								],
							};
		}
		const path =
			record.kind === "watch"
				? "/sync/history"
				: `/sync/ratings${remove ? "/remove" : ""}`;
		const { data } = await this.request(path, token, body);
		const outcome = z
			.object({
				not_found: z.record(z.string(), z.array(z.unknown())).optional(),
			})
			.parse(data);
		if (Object.values(outcome.not_found ?? {}).some((items) => items.length))
			throw new TraktSyncError(
				"Trakt could not match this title. Choose a match or ignore this item.",
			);
	}
}
