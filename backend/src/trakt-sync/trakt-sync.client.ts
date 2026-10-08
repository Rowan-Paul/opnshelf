import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { BackendEnv } from "../config/env.schema";
import { type MediaType, type SyncRecord } from "./reconcile";

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
export class TraktSyncError extends Error {
	constructor(
		message: string,
		readonly status = 0,
		readonly retrySeconds = 60,
	) {
		super(message);
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
		traktId: item.ids.trakt,
		traktParentId: parent?.ids.trakt,
	};
}

@Injectable()
export class TraktSyncClient {
	private nextRequest = 0;
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
	): Promise<{ data: unknown; headers: Headers }> {
		// Pace both reads and writes below Trakt's per-user limits. No credential logging.
		const delay = Math.max(0, this.nextRequest - Date.now());
		this.nextRequest = Math.max(Date.now(), this.nextRequest) + 1100;
		if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
		const response = await fetch(`https://api.trakt.tv${path}`, {
			method: body === undefined ? "GET" : "POST",
			headers: {
				"Content-Type": "application/json",
				"trakt-api-key": this.clientId,
				"trakt-api-version": "2",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(15_000),
		});
		if (!response.ok) {
			const retry = Number(response.headers.get("retry-after"));
			throw new TraktSyncError(
				response.status === 401
					? "Reconnect Trakt to continue syncing."
					: response.status === 429
						? "Trakt rate limit reached. Sync will retry."
						: "Trakt could not complete the request. Sync will retry.",
				response.status,
				Number.isFinite(retry) && retry > 0 ? retry : 60,
			);
		}
		return {
			data: response.status === 204 ? null : await response.json(),
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
	async snapshot(token: string): Promise<SyncRecord[]> {
		const before = (await this.request("/sync/last_activities", token)).data;
		const watches = await this.pages("/sync/history", token, "watch");
		const ratings: SyncRecord[] = [];
		for (const type of ["movies", "shows", "seasons", "episodes"])
			ratings.push(
				...(await this.pages(`/sync/ratings/${type}`, token, "rating")),
			);
		const after = (await this.request("/sync/last_activities", token)).data;
		if (JSON.stringify(before) !== JSON.stringify(after))
			throw new TraktSyncError(
				"Trakt changed during the read. Sync will read a fresh snapshot.",
			);
		return [...watches, ...ratings];
	}
	async pages(
		path: string,
		token: string,
		kind: "watch" | "rating",
	): Promise<SyncRecord[]> {
		const result: SyncRecord[] = [];
		const seen = new Set<string>();
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
			if (page === 1) expectedCount = count;
			if (
				count === undefined ||
				!Number.isInteger(count) ||
				count < 0 ||
				count !== expectedCount ||
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
	async write(token: string, record: SyncRecord, remove = false) {
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
		if (record.traktId) {
			const plural: Record<MediaType, string> = {
				movie: "movies",
				show: "shows",
				season: "seasons",
				episode: "episodes",
			};
			body = {
				[plural[record.mediaType]]: [
					{ ids: { trakt: record.traktId }, ...props },
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
