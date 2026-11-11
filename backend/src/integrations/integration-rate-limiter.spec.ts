import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { TraktSyncClient } from "../trakt-sync/trakt-sync.client";
import { TraktSyncService } from "../trakt-sync/trakt-sync.service";
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

it("sets and clears the external account scope around a real connection lease", async () => {
	const service = new TraktSyncService(
		{
			integrationConnection: { updateMany: async () => ({ count: 1 }) },
		} as never,
		new TraktSyncClient(config),
		{} as never,
		config,
		{} as never,
	);
	await service["locked"](
		{ id: "connection", accountId: "external-account" } as never,
		async () => {
			expect(integrationRateLimitScope.getStore()).toBe("external-account");
		},
	);
	expect(integrationRateLimitScope.getStore()).toBeUndefined();
});

it("does not apply a long cooldown to successful exhausted headers without reset data", async () => {
	const client = new TraktSyncClient(config);
	const fetcher = vi.fn(async () =>
		Response.json(
			{},
			{ headers: { "x-ratelimit": JSON.stringify({ remaining: 0 }) } },
		),
	);
	vi.stubGlobal("fetch", fetcher);
	await client.request("/sync/history", "account", {});
	const next = client.request("/sync/history", "account", {});
	await vi.advanceTimersByTimeAsync(1100);
	await next;
	expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not extend an existing cooldown when repeatedly checking it", async () => {
	const limiter = new IntegrationRateLimiter({
		name: "Fixture",
		intervalMs: 1100,
		retrySeconds: 60,
	});
	const request = vi.fn(async () => Response.json({}));
	await expect(
		limiter.run(
			"account",
			async () =>
				new Response(null, { status: 429, headers: { "retry-after": "4" } }),
		),
	).rejects.toMatchObject({ status: 429 });
	for (let check = 0; check < 5; check++) {
		await vi.advanceTimersByTimeAsync(400);
		await expect(limiter.run("account", request)).rejects.toMatchObject({
			status: 429,
		});
	}
	await vi.advanceTimersByTimeAsync(2000);
	await limiter.run("account", request);
	expect(request).toHaveBeenCalledOnce();
});

it.each([1000, -1000])(
	"fits Trakt's short or elapsed write window into request pacing (%s ms)",
	async (resetOffset) => {
		const client = new TraktSyncClient(config);
		const fetcher = vi.fn(async () =>
			Response.json(
				{},
				{
					headers: {
						"x-ratelimit": JSON.stringify({
							remaining: 0,
							until: new Date(Date.now() + resetOffset).toISOString(),
						}),
					},
				},
			),
		);
		vi.stubGlobal("fetch", fetcher);
		await client.request("/sync/history", "account", {});
		const next = client.request("/sync/history", "account", {});
		await vi.advanceTimersByTimeAsync(1100);
		await next;
		expect(fetcher).toHaveBeenCalledTimes(2);
	},
);

it("reports oversized requests as retryable failures without sending them", async () => {
	const limiter = new IntegrationRateLimiter({
		name: "Fixture",
		intervalMs: 1100,
		retrySeconds: 60,
		budgets: [[60_000, 2]],
	});
	const request = vi.fn();
	await expect(limiter.run("account", request, 3)).rejects.toMatchObject({
		status: 0,
	});
	expect(request).not.toHaveBeenCalled();
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
		intervalMs: 1100,
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
