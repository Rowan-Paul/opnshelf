import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { TraktSyncClient } from "../trakt-sync/trakt-sync.client";
import { BingersSyncClient } from "../bingers-sync/bingers-sync.client";
import { syncPdsSession } from "./sync-pds";
import {
	integrationRateLimitScope,
	IntegrationRateLimiter,
} from "./integration-rate-limiter";

const config = parseEnvironment({
	NODE_ENV: "test",
	TRAKT_API_KEY: "fixture",
	BACKEND_PUBLIC_URL: "https://fixture.test",
});
const payload = {
	items: [],
	has_more: false,
	next_cursor: "cursor",
	titles: {},
};
let account = 0;
async function transport(provider: "PDS" | "Trakt" | "Bingers") {
	const key = `fixture-${++account}`;
	if (provider === "Trakt") {
		const client = new TraktSyncClient(config);
		return () => client.request("/users/settings", key);
	}
	if (provider === "Bingers") {
		const client = new BingersSyncClient(config);
		return () => client.readFeed(key);
	}
	const session = await syncPdsSession(
		{
			restore: async () => ({
				did: key,
				fetchHandler: (path: string, init?: RequestInit) =>
					fetch(`https://pds.fixture.test${path}`, init),
			}),
		} as never,
		key,
	);
	return () => session.fetchHandler("/xrpc/com.atproto.repo.listRecords");
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

it.each(["Trakt", "Bingers"] as const)(
	"%s retains an account cooldown after token rotation",
	async (provider) => {
		const client =
			provider === "Trakt"
				? new TraktSyncClient(config)
				: new BingersSyncClient(config);
		const call = (token: string) =>
			client instanceof TraktSyncClient
				? client.request("/users/settings", token)
				: client.readFeed(token);
		const fetcher = vi.fn(
			async () =>
				new Response(null, { status: 429, headers: { "retry-after": "900" } }),
		);
		vi.stubGlobal("fetch", fetcher);
		await integrationRateLimitScope.run("stable-account", async () => {
			await expect(call("old-token")).rejects.toMatchObject({ status: 429 });
			await expect(call("new-token")).rejects.toMatchObject({
				status: 429,
				retrySeconds: 900,
			});
		});
		expect(fetcher).toHaveBeenCalledOnce();
	},
);

it("uses configured rolling budgets and yields instead of sending over budget", async () => {
	const limiter = new IntegrationRateLimiter({
		name: "Fixture",
		retrySeconds: 60,
		requestPoints: 1,
		budgets: [[60_000, 2]],
	});
	const request = vi.fn(async () => Response.json({}));
	await limiter.run("account", request);
	const second = limiter.run("account", request);
	await vi.runAllTimersAsync();
	await second;
	const third = expect(limiter.run("account", request)).rejects.toMatchObject({
		status: 429,
	});
	await vi.runAllTimersAsync();
	await third;
	expect(request).toHaveBeenCalledTimes(2);
});

it.each(["PDS", "Trakt", "Bingers"] as const)(
	"%s blocks queued requests and later calls after a rate limit",
	async (provider) => {
		const fetcher = vi.fn(
			async () =>
				new Response(null, { status: 429, headers: { "retry-after": "900" } }),
		);
		vi.stubGlobal("fetch", fetcher);
		const call = await transport(provider);
		const results = Promise.allSettled([call(), call()]);
		await vi.runAllTimersAsync();
		expect(await results).toEqual([
			{
				status: "rejected",
				reason: expect.objectContaining({ status: 429, retrySeconds: 900 }),
			},
			{
				status: "rejected",
				reason: expect.objectContaining({ status: 429, retrySeconds: 900 }),
			},
		]);
		await expect(call()).rejects.toMatchObject({
			status: 429,
			retrySeconds: 900,
		});
		expect(fetcher).toHaveBeenCalledOnce();
	},
);

it.each(["PDS", "Trakt", "Bingers"] as const)(
	"%s honors exhausted response headers before issuing another request",
	async (provider) => {
		const until = new Date(Date.now() + 900_000).toISOString();
		const fetcher = vi.fn(async () =>
			Response.json(payload, {
				headers: {
					"x-ratelimit": JSON.stringify({ remaining: 0, until }),
				},
			}),
		);
		vi.stubGlobal("fetch", fetcher);
		const call = await transport(provider);
		const first = call();
		await vi.runAllTimersAsync();
		await first;
		await expect(call()).rejects.toMatchObject({
			status: 429,
			retrySeconds: expect.any(Number),
		});
		expect(fetcher).toHaveBeenCalledOnce();
	},
);
