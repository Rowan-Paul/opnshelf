import {
	IntegrationRateLimiter,
	integrationRateLimitKey,
} from "../integrations/integration-rate-limiter";
import { rateLimitRetrySeconds } from "../common/rate-limit-headers";
import { Injectable } from "@nestjs/common";
import { getFrontendUrl } from "../auth/auth-flow";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { BackendEnv } from "../config/env.schema";
import { IntegrationError } from "../integrations/integration-error";
import { type SyncRecord } from "../integrations/reconcile";

const origin = "https://api.bingers.app";
const resource = `${origin}/v1`;
const tokenSchema = z.object({
	access_token: z.string().min(1),
	id_token: z.string().min(1).optional(),
	refresh_token: z.string().min(1).optional(),
	expires_in: z.number().int().positive(),
	token_type: z.string().regex(/^bearer$/i),
	// RFC 6749 section 5.1: omitted scope is identical to the requested scope.
	scope: z.string().default("openid profile library:read offline_access"),
});
export type BingersToken = z.infer<typeof tokenSchema> & {
	refresh_token: string;
};
export type BingersCredential = { connectionId: string; token: string };
export class BingersSyncError extends IntegrationError {}
export class BingersCursorRejected extends BingersSyncError {}
export type BingersFeed = { cursor?: string; records: SyncRecord[] };
const titleSchema = z.object({
	id: z.uuid(),
	kind: z.enum(["movie", "show"]),
	title: z.string(),
	ids: z.object({
		tmdb: z
			.string()
			.regex(/^[1-9]\d*$/)
			.optional(),
	}),
});
const entrySchema = z.object({
	entity_kind: z.enum(["movie", "episode"]),
	entity_id: z.uuid(),
	title_id: z.uuid().nullable(),
	watched: z.boolean(),
	plays: z.number().int().nonnegative(),
	first_watched_at: z.iso.datetime({ offset: true }).nullable(),
	last_watched_at: z.iso.datetime({ offset: true }).nullable(),
	rating: z.number().min(1).max(5).multipleOf(0.5).nullable(),
	updated_at: z.iso.datetime({ offset: true }),
	deleted: z.boolean(),
});
const pageSchema = z.object({
	items: z.array(entrySchema).max(200),
	next_cursor: z.string().min(1),
	has_more: z.boolean(),
	titles: z.record(z.string(), titleSchema).default({}),
});

/** Normalize the documented feed only. Unknown episode coordinates never become episode zero. */
export function bingersRecords(payload: unknown): {
	page: z.infer<typeof pageSchema>;
	records: Map<string, SyncRecord[]>;
} {
	const page = pageSchema.parse(payload);
	const records = new Map<string, SyncRecord[]>();
	for (const row of page.items) {
		const entity = `${row.entity_kind}:${row.entity_id}`;
		const items: SyncRecord[] = [];
		records.set(entity, items);
		if (row.deleted) continue;
		const title = page.titles[row.title_id ?? row.entity_id];
		if (
			!title ||
			title.id !== (row.title_id ?? row.entity_id) ||
			title.kind !== (row.entity_kind === "movie" ? "movie" : "show")
		)
			throw new BingersSyncError(
				"Bingers returned incomplete title information. Sync will retry.",
			);
		const base = {
			mediaType: row.entity_kind,
			mediaId: title.ids.tmdb ?? null,
			season: 0,
			episode: 0,
			title: title.title,
			...(row.entity_kind === "episode"
				? {
						coordinatesUnknown: true,
						problem:
							"Bingers cannot provide enough information to identify this episode. It was not transferred.",
					}
				: {}),
		};
		if (row.watched) {
			const exact =
				row.plays === 1 &&
				row.first_watched_at !== null &&
				row.last_watched_at !== null &&
				Date.parse(row.first_watched_at) === Date.parse(row.last_watched_at);
			items.push({
				...base,
				key: `watch:${entity}`,
				kind: "watch",
				value: row.last_watched_at
					? new Date(row.last_watched_at).toISOString()
					: null,
				...(!exact
					? {
							problem:
								"Bingers does not expose individual dates for this Watch history. No Watches were invented or replaced.",
						}
					: {}),
			});
		} else if (row.plays > 0) {
			// Inconsistent aggregates are not authoritative Watch removals.
			items.push({
				...base,
				key: `watch:${entity}`,
				kind: "watch",
				value: null,
				problem:
					"Bingers returned inconsistent Watch history. The linked Watch is preserved.",
			});
		}
		if (row.rating !== null)
			items.push({
				...base,
				key: `rating:${entity}`,
				kind: "rating",
				value: row.rating * 2,
			});
	}
	return { page, records };
}

@Injectable()
export class BingersSyncClient {
	private readonly requests = new IntegrationRateLimiter({
		name: "Bingers",
		retrySeconds: 60,
		requestPoints: 1,
		budgets: [
			[60_000, 60],
			[60 * 60_000, 1000],
		],
	});
	private jwks: JWTVerifyGetKey = createRemoteJWKSet(
		new URL(`${origin}/auth/jwks`),
	);
	constructor(private readonly config: BackendEnv) {}
	get configured() {
		return Boolean(this.config.BACKEND_PUBLIC_URL?.startsWith("https://"));
	}
	get callbackUrl() {
		return `${this.config.BACKEND_PUBLIC_URL}/bingers-sync/callback`;
	}
	get clientId() {
		return `${this.config.BACKEND_PUBLIC_URL}/bingers-sync/client-metadata`;
	}
	/** Same-origin client page; it redirects to the Web App homepage. */
	get clientUri() {
		return `${this.config.BACKEND_PUBLIC_URL}/bingers-sync/client`;
	}
	get homepage() {
		return getFrontendUrl(this.config);
	}
	metadata() {
		return {
			client_id: this.clientId,
			client_name: "Opnshelf",
			client_uri: this.clientUri,
			redirect_uris: [this.callbackUrl],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		};
	}
	private async request(path: string, token?: string, form?: URLSearchParams) {
		const key = integrationRateLimitKey(token);
		const result = await this.requests.run(key, async () => {
			const response = await fetch(`${origin}${path}`, {
				method: form ? "POST" : "GET",
				redirect: "error",
				headers: {
					Accept: "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					...(form
						? { "Content-Type": "application/x-www-form-urlencoded" }
						: {}),
				},
				body: form,
				signal: AbortSignal.timeout(15_000),
			});
			if (!response.ok) {
				const retry = rateLimitRetrySeconds(
					response.headers,
					response.status === 403 ? 3600 : 60,
				);
				throw new BingersSyncError(
					response.status === 403
						? "Bingers API access requires a Legend or Icon subscription and library read permission. Restore access, then reconnect Bingers."
						: response.status === 401
							? "Reconnect Bingers to continue syncing."
							: response.status === 429
								? "Bingers rate limit reached. Sync will retry."
								: "Bingers could not complete the request. Sync will retry.",
					response.status === 403 ? 401 : response.status,
					retry,
				);
			}
			const text = await response.text();
			return {
				data: text.trim() ? (JSON.parse(text) as unknown) : null,
				headers: response.headers,
			};
		});
		return result.data;
	}
	private async tokens(fields: Record<string, string>) {
		const token = tokenSchema.parse(
			await this.request(
				"/auth/oauth2/token",
				undefined,
				new URLSearchParams({ client_id: this.clientId, resource, ...fields }),
			),
		);
		const scopes = new Set(token.scope.split(" "));
		if (!scopes.has("library:read"))
			throw new BingersSyncError(
				"Reconnect Bingers and allow library read access.",
				401,
			);
		const refresh_token = token.refresh_token ?? fields.refresh_token;
		if (!refresh_token)
			throw new BingersSyncError(
				"Bingers did not grant offline access. Connect again.",
				401,
			);
		return { ...token, refresh_token };
	}
	exchange(code: string, verifier: string) {
		return this.tokens({
			grant_type: "authorization_code",
			code,
			code_verifier: verifier,
			redirect_uri: this.callbackUrl,
		});
	}
	refresh(refresh_token: string) {
		return this.tokens({ grant_type: "refresh_token", refresh_token });
	}
	async revoke(token: string) {
		await this.request(
			"/auth/oauth2/revoke",
			undefined,
			new URLSearchParams({ client_id: this.clientId, token }),
		);
	}
	async profile(idToken: string | undefined, nonce: string) {
		if (!idToken)
			throw new BingersSyncError(
				"Bingers did not provide an OpenID identity. Connect again.",
				401,
			);
		const { payload } = await jwtVerify(idToken, this.jwks, {
			issuer: origin,
			audience: this.clientId,
			algorithms: ["EdDSA"],
			requiredClaims: ["sub", "exp", "iat", "nonce"],
			maxTokenAge: "10m",
		});
		if (
			(payload.azp !== undefined && payload.azp !== this.clientId) ||
			(Array.isArray(payload.aud) &&
				payload.aud.length > 1 &&
				payload.azp !== this.clientId)
		)
			throw new BingersSyncError(
				"Bingers identity belongs to another client. Connect again.",
				401,
			);
		if (payload.nonce !== nonce)
			throw new BingersSyncError(
				"Bingers authorization did not match this sign-in. Connect again.",
				401,
			);
		return z
			.object({ sub: z.string().min(1), name: z.string().optional() })
			.parse(payload);
	}
	/** A complete read result; the owning Integration service persists it under its lease. */
	async readFeed(
		token: string,
		feed: BingersFeed = { records: [] },
	): Promise<BingersFeed> {
		const current = new Map<string, SyncRecord>();
		for (const record of feed.records) current.set(record.key, record);
		let cursor = feed.cursor;
		const seen = new Set<string>();
		for (let pages = 0; ; pages++) {
			if (pages >= 1000)
				throw new BingersSyncError(
					"Bingers history is too large for one read. No partial state was applied.",
				);
			const query = new URLSearchParams({
				include: "titles",
				limit: "200",
				...(cursor ? { cursor } : {}),
			});
			let payload: unknown;
			try {
				payload = await this.request(`/v1/entries?${query}`, token);
			} catch (error) {
				if (cursor && error instanceof BingersSyncError && error.status === 400)
					throw new BingersCursorRejected(
						"Bingers rejected the saved history cursor. A complete read is required.",
						400,
					);
				throw error;
			}
			const { page, records } = bingersRecords(payload);
			for (const [entity, values] of records) {
				current.delete(`watch:${entity}`);
				current.delete(`rating:${entity}`);
				for (const record of values) current.set(record.key, record);
			}
			if (
				page.has_more &&
				(page.next_cursor === cursor || seen.has(page.next_cursor))
			)
				throw new BingersSyncError(
					"Bingers returned a repeated history cursor. No partial state was applied.",
				);
			cursor = page.next_cursor;
			seen.add(cursor);
			if (!page.has_more) break;
		}
		return { cursor, records: [...current.values()] };
	}
	async write(): Promise<void> {
		throw new BingersSyncError("Sending changes to Bingers is not supported.");
	}
}
