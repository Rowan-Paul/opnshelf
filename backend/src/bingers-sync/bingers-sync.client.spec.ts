import { BingersSyncService } from "./bingers-sync.service";
import type { LocalSyncRecords } from "../integrations/local-records.service";
import type { WatchAccountLock } from "../privacy/watch-account-lock";
import type { SyncRecordTypes } from "../integrations/adapter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import type { PrismaService } from "../prisma/prisma.service";
import { BingersSyncClient, bingersRecords } from "./bingers-sync.client";

const movie = "00000000-0000-4000-8000-000000000001";
const episode = "00000000-0000-4000-8000-000000000002";
const show = "00000000-0000-4000-8000-000000000003";
const date = "2026-10-01T21:00:00Z";
const row = {
	entity_kind: "movie",
	entity_id: movie,
	title_id: movie,
	watched: true,
	plays: 1,
	first_watched_at: date,
	last_watched_at: date,
	rating: 3.5,
	updated_at: date,
	deleted: false,
};
const page = (items: unknown[] = [row], extra = {}) => ({
	items,
	has_more: false,
	next_cursor: "cursor-1",
	titles: {
		[movie]: {
			id: movie,
			kind: "movie",
			title: "Fixture movie",
			ids: { tmdb: "42" },
		},
		[show]: {
			id: show,
			kind: "show",
			title: "Fixture show",
			ids: { tmdb: "43" },
		},
	},
	...extra,
});
const config = parseEnvironment({
	NODE_ENV: "test",
	BACKEND_PUBLIC_URL: "https://api.example.test",
	FRONTEND_URL: "https://example.test",
});
const credential = { connectionId: "connection-1", token: "fixture-token" };
const values = (payload: unknown) =>
	[...bingersRecords(payload).records.values()].flat();
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("maps one exact movie Watch and a half-star Rating without coupling them", () => {
	expect(values(page())).toMatchObject([
		{ kind: "watch", mediaId: "42", value: "2026-10-01T21:00:00.000Z" },
		{ kind: "rating", value: 7 },
	]);
	expect(values(page())[0].problem).toBeUndefined();
	expect(values(page([{ ...row, watched: false, plays: 0 }]))).toMatchObject([
		{ kind: "rating", value: 7 },
	]);
});
it.each([
	{ plays: 3 },
	{ first_watched_at: null },
	{ last_watched_at: null },
	{ first_watched_at: "2025-01-01T00:00:00Z" },
	{ watched: false },
])("holds unrepresentable or inconsistent Watches: %j", (patch) => {
	const records = values(page([{ ...row, ...patch }]));
	expect(records.find((r) => r.kind === "watch")?.problem).toBeTruthy();
	expect(records.find((r) => r.kind === "rating")?.problem).toBeUndefined();
});
it("keeps episode Watches and Ratings as problems without invented coordinates", () => {
	const records = values(
		page([
			{ ...row, entity_kind: "episode", entity_id: episode, title_id: show },
		]),
	);
	expect(records).toHaveLength(2);
	expect(records.every((r) => r.coordinatesUnknown)).toBe(true);
	expect(
		records.every((r) => r.problem?.includes("identify this episode")),
	).toBe(true);
});
it("requires complete titles and valid dates instead of treating unreadable data as empty", () => {
	expect(() => values(page([row], { titles: {} }))).toThrow();
	expect(() =>
		values(page([{ ...row, last_watched_at: "invalid" }])),
	).toThrow();
	expect(values(page([{ ...row, deleted: true }], { titles: {} }))).toEqual([]);
});

function harness() {
	let remoteFeed: unknown = {};
	const prisma = {
		integrationConnection: {
			findUniqueOrThrow: vi.fn(async () => ({ remoteFeed })),
			update: vi.fn(async ({ data }: { data: { remoteFeed: unknown } }) => {
				remoteFeed = data.remoteFeed;
				return { id: "connection-1" };
			}),
		},
	};
	const client = new BingersSyncClient(config);
	const build = () =>
		new BingersSyncService(
			prisma as unknown as PrismaService,
			client,
			{} as LocalSyncRecords,
			config,
			{} as WatchAccountLock,
		);
	const service = build();
	const snapshot = (c = credential, types?: SyncRecordTypes) =>
		service["readSnapshot"](c, types);
	const restart = () => ({
		snapshot: (c = credential, types?: SyncRecordTypes) =>
			build()["readSnapshot"](c, types),
	});
	const fetcher = vi.fn();
	vi.stubGlobal("fetch", fetcher);
	return {
		client,
		prisma,
		fetcher,
		snapshot,
		restart,
		service,
		feed: () => remoteFeed,
	};
}
const response = (data: unknown, status = 200, headers = {}) =>
	new Response(JSON.stringify(data), { status, headers });

describe("durable change feed", () => {
	it("persists a full state and applies cursor deltas across client restarts and type changes", async () => {
		const h = harness();
		h.fetcher.mockResolvedValueOnce(response(page()));
		expect(
			await h.snapshot(credential, { watches: true, ratings: false }),
		).toHaveLength(1);
		const restarted = h.restart();
		h.fetcher.mockResolvedValueOnce(
			response(page([], { next_cursor: "cursor-2" })),
		);
		expect(await restarted.snapshot(credential)).toHaveLength(2);
		expect(h.fetcher.mock.calls[1][0]).toContain("cursor=cursor-1");
		h.fetcher.mockResolvedValueOnce(
			response(
				page([{ ...row, deleted: true }], {
					next_cursor: "cursor-3",
					titles: {},
				}),
			),
		);
		expect(await restarted.snapshot(credential)).toEqual([]);
		expect(h.feed()).toEqual({ cursor: "cursor-3", records: [] });
	});
	it("retains the previous cursor and records when a later page fails", async () => {
		const h = harness();
		h.fetcher.mockResolvedValueOnce(response(page()));
		await h.snapshot(credential);
		const before = structuredClone(h.feed());
		h.fetcher
			.mockResolvedValueOnce(
				response(
					page([{ ...row, deleted: true }], {
						has_more: true,
						next_cursor: "cursor-2",
					}),
				),
			)
			.mockResolvedValueOnce(response({}, 503));
		await expect(h.snapshot(credential)).rejects.toThrow("retry");
		expect(h.feed()).toEqual(before);
	});
	it("rejects repeated cursors and malformed pages without advancing state", async () => {
		const h = harness();
		h.fetcher.mockResolvedValueOnce(response(page()));
		await h.snapshot(credential);
		h.fetcher.mockResolvedValueOnce(response(page([], { has_more: true })));
		await expect(h.snapshot(credential)).rejects.toThrow("repeated");
		h.fetcher.mockResolvedValueOnce(response({ items: [] }));
		await expect(h.snapshot(credential)).rejects.toThrow();
		expect(h.prisma.integrationConnection.update).toHaveBeenCalledTimes(1);
	});
	it("turns a previously exact Watch into a problem instead of replacing its date", async () => {
		const h = harness();
		h.fetcher.mockResolvedValueOnce(response(page()));
		await h.snapshot(credential);
		h.fetcher.mockResolvedValueOnce(
			response(
				page([{ ...row, plays: 2, last_watched_at: "2026-10-02T21:00:00Z" }], {
					next_cursor: "cursor-2",
				}),
			),
		);
		const records = await h.snapshot(credential);
		expect(records.find((r) => r.kind === "watch")?.problem).toBeTruthy();
		expect(records).toHaveLength(2);
	});
});
it.each([
	[403, "Legend or Icon"],
	[401, "Reconnect"],
	[429, "rate limit"],
])("reports safe API errors for %i", async (status, message) => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(
		response({ error: "private payload" }, status, { "Retry-After": "900" }),
	);
	await expect(h.snapshot(credential)).rejects.toMatchObject({
		message: expect.stringContaining(message),
		retrySeconds: 900,
	});
	expect(h.prisma.integrationConnection.update).not.toHaveBeenCalled();
});
it("uses form-encoded PKCE and the API audience, and rejects write attempts", async () => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(
		response({
			access_token: "fixture-access",
			refresh_token: "fixture-refresh",
			expires_in: 3600,
			token_type: "Bearer",
			scope: "library:read offline_access",
		}),
	);
	await h.client.exchange("code", "verifier");
	const [url, init] = h.fetcher.mock.calls[0];
	expect(url).toBe("https://api.bingers.app/auth/oauth2/token");
	expect(init.body.get("resource")).toBe("https://api.bingers.app/v1");
	expect(init.body.get("code_verifier")).toBe("verifier");
	await expect(h.client.write()).rejects.toThrow("not supported");
	expect(h.client.metadata().redirect_uris).toEqual([h.client.callbackUrl]);
});

it("retains refresh credentials when OAuth omits an unchanged scope and refresh token", async () => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(
		response({
			access_token: "fixture-new",
			expires_in: 3600,
			token_type: "Bearer",
		}),
	);
	expect(await h.client.refresh("fixture-refresh")).toMatchObject({
		refresh_token: "fixture-refresh",
	});
	h.fetcher.mockResolvedValueOnce(
		response({
			access_token: "fixture-new",
			refresh_token: "fixture-new-refresh",
			expires_in: 3600,
			token_type: "Bearer",
			scope: "profile",
		}),
	);
	await expect(h.client.refresh("fixture-refresh")).rejects.toThrow(
		"library read",
	);
});

it("replaces a rejected cursor only after a complete reread succeeds", async () => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(response(page()));
	await h.snapshot();
	h.fetcher
		.mockResolvedValueOnce(response({}, 400))
		.mockResolvedValueOnce(response(page([], { next_cursor: "fresh" })));
	expect(await h.snapshot()).toEqual([]);
	expect(h.fetcher.mock.calls.at(-2)?.[0]).toContain("cursor=cursor-1");
	expect(h.fetcher.mock.calls.at(-1)?.[0]).not.toContain("cursor=");
	expect(h.feed()).toEqual({ cursor: "fresh", records: [] });
});
it("keeps the last complete feed when cursor recovery fails, without looping", async () => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(response(page()));
	await h.snapshot();
	const before = structuredClone(h.feed());
	h.fetcher
		.mockResolvedValueOnce(response({}, 400))
		.mockResolvedValueOnce(response({}, 503));
	await expect(h.snapshot()).rejects.toThrow();
	expect(h.feed()).toEqual(before);
	expect(h.fetcher).toHaveBeenCalledTimes(3);
});
it("accepts an empty delta without titles but rejects live rows without title details", async () => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(response(page()));
	await h.snapshot();
	h.fetcher.mockResolvedValueOnce(
		response({ items: [], has_more: false, next_cursor: "cursor-2" }),
	);
	expect(await h.snapshot()).toHaveLength(2);
	h.fetcher.mockResolvedValueOnce(
		response({ items: [row], has_more: false, next_cursor: "cursor-3" }),
	);
	await expect(h.snapshot()).rejects.toThrow("incomplete title");
	expect(h.feed()).toMatchObject({ cursor: "cursor-2" });
});
it("does not persist cursor advancement during a scoped confirmation read", async () => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(response(page()));
	await h.snapshot();
	h.fetcher.mockResolvedValueOnce(
		response(page([], { next_cursor: "cursor-2" })),
	);
	await h.service["remote"].readForRecord(credential, values(page())[0]);
	expect(h.prisma.integrationConnection.update).toHaveBeenCalledTimes(1);
	expect(h.feed()).toMatchObject({ cursor: "cursor-1" });
});
it("clears cached history on disconnect even when remote revocation fails", async () => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(response(page()));
	await h.snapshot();
	vi.spyOn(
		h.service as unknown as {
			crypt: (value: string, decrypt?: boolean) => string;
		},
		"crypt",
	).mockReturnValue("fixture-token");
	vi.spyOn(h.client, "revoke").mockRejectedValue(new Error("unavailable"));
	await expect(
		h.service["revoke"]({
			id: "connection-1",
			accessToken: "encrypted-access",
			refreshToken: "encrypted-refresh",
		} as Parameters<(typeof h.service)["revoke"]>[0]),
	).rejects.toThrow("fully revoked");
	expect(h.feed()).toEqual({});
	expect(h.prisma.integrationConnection.update).toHaveBeenLastCalledWith(
		expect.objectContaining({
			data: { remoteFeed: {}, remoteSnapshot: [], remoteReadAt: null },
		}),
	);
});
it("sends subscription rejection to reconnection instead of a minute retry loop", async () => {
	const h = harness();
	h.fetcher.mockResolvedValueOnce(response({}, 403));
	await expect(h.snapshot()).rejects.toMatchObject({
		status: 401,
		retrySeconds: 3600,
		message: expect.stringContaining("Legend or Icon"),
	});
});
