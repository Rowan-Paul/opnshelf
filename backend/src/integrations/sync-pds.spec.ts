import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Agent } from "@atproto/api";
import { PdsRequestError } from "../common/pds-request-error";
import {
	SyncPdsRequests,
	syncPdsFailure,
	syncPdsSession,
	syncPdsRequests,
} from "./sync-pds";
import { requireWatchSession } from "../privacy/watch-operation";
import { PopfeedSyncClient } from "../popfeed-sync/popfeed-sync.client";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("honors Retry-After on real Popfeed repository reads and blocks another run", async () => {
	const fetch = vi.fn(
		async () =>
			new Response(null, {
				status: 429,
				headers: { "retry-after": "900" },
			}),
	);
	vi.stubGlobal("fetch", fetch);
	const credential = {
		did: "did:plc:limited-popfeed",
		pds: "https://pds.fixture.test",
		timeZone: "UTC",
	};
	const client = new PopfeedSyncClient();
	await expect(client.repository(credential)).rejects.toMatchObject({
		status: 429,
		retrySeconds: 900,
	});
	await expect(client.repository({ ...credential })).rejects.toMatchObject({
		status: 429,
		retrySeconds: 900,
	});
	const restore = vi.fn();
	await expect(
		syncPdsSession({ restore }, credential.did),
	).rejects.toMatchObject({ status: 429, retrySeconds: 900 });
	expect(restore).not.toHaveBeenCalled();
	expect(fetch).toHaveBeenCalledOnce();
});

it("serializes concurrent pages and shares request pacing across calls for an account", async () => {
	const queue = new SyncPdsRequests();
	const starts: number[] = [];
	const request = async () => {
		starts.push(Date.now());
		return Response.json({});
	};
	const jobs = [
		queue.run("owner", request),
		queue.run("owner", request),
		queue.run("owner", request),
	];
	await vi.runAllTimersAsync();
	await Promise.all(jobs);
	expect(starts.map((time) => time - starts[0])).toEqual([0, 1100, 2200]);
});

it("stops already queued reads after a 429 and retains its cooldown across runs", async () => {
	const queue = new SyncPdsRequests();
	const first = queue.run(
		"owner",
		async () =>
			new Response(null, { status: 429, headers: { "retry-after": "900" } }),
	);
	const request = vi.fn(async () => Response.json({}));
	const second = queue.run("owner", request);
	const results = await Promise.allSettled([first, second]);
	expect(results).toEqual([
		{
			status: "rejected",
			reason: expect.objectContaining({ retrySeconds: 900 }),
		},
		{
			status: "rejected",
			reason: expect.objectContaining({ retrySeconds: 900 }),
		},
	]);
	await expect(queue.run("owner", request)).rejects.toMatchObject({
		retrySeconds: 900,
	});
	expect(request).not.toHaveBeenCalled();
	await expect(queue.run("another-owner", request)).resolves.toBeInstanceOf(
		Response,
	);
	await vi.advanceTimersByTimeAsync(900_000);
	await expect(queue.run("owner", request)).resolves.toBeInstanceOf(Response);
});

it("paces authenticated Agent requests without mutating the SDK session or losing private fields", async () => {
	class Session {
		#did = "did:plc:paced-session";
		get did() {
			return this.#did;
		}
		fetchHandler = vi.fn(async () => Response.json({ records: [] }));
		getTokenInfo() {
			return { scope: this.#did };
		}
	}
	const original = new Session();
	const restore = vi.fn(async () => original);
	const session = await syncPdsSession({ restore } as never, original.did);
	expect(session.did).toBe(original.did);
	expect(await requireWatchSession(session).getTokenInfo()).toEqual({
		scope: original.did,
	});
	const request = new Agent(session).com.atproto.repo.listRecords({
		repo: original.did,
		collection: "social.popfeed.feed.listItem",
	});
	expect(original.fetchHandler).not.toHaveBeenCalled();
	await vi.runAllTimersAsync();
	await request;
	expect(original.fetchHandler).toHaveBeenCalledOnce();
});

it("preserves nested OAuth and XRPC failures as safe run-stopping errors", () => {
	const error = new Error("private upstream diagnostics", {
		cause: new PdsRequestError(429, 900),
	});
	expect(syncPdsFailure(error)).toMatchObject({
		status: 429,
		retrySeconds: 900,
	});
	expect((syncPdsFailure(error) as Error).message).not.toContain("private");
});

it("requires reconnection only when the saved session is missing", async () => {
	await expect(
		syncPdsSession({ restore: async () => undefined }, "missing-owner"),
	).rejects.toMatchObject({ status: 401 });
	const failure = new PdsRequestError(429, 900);
	await expect(
		syncPdsSession(
			{
				restore: async () => {
					throw failure;
				},
			},
			"limited-owner",
		),
	).rejects.toMatchObject({ status: 429, retrySeconds: 900 });
	const restore = vi.fn();
	await expect(
		syncPdsSession({ restore }, "limited-owner"),
	).rejects.toMatchObject({ retrySeconds: 900 });
	expect(restore).not.toHaveBeenCalled();
});

it("defers writes at the reserved hourly budget without making a request", async () => {
	const queue = new SyncPdsRequests();
	const request = vi.fn(async () => Response.json({}));
	await queue.run("budget", request, 2499);
	const next = expect(queue.run("budget", request, 3)).rejects.toMatchObject({
		status: 429,
	});
	await vi.advanceTimersByTimeAsync(1100);
	await next;
	expect(request).toHaveBeenCalledOnce();
	await vi.advanceTimersByTimeAsync(3600_000);
	await queue.run("budget", request, 3);
	expect(request).toHaveBeenCalledTimes(2);
});

it("also reserves the daily budget across hourly windows", async () => {
	const queue = new SyncPdsRequests();
	const request = vi.fn(async () => Response.json({}));
	for (let hour = 0; hour < 7; hour++) {
		await queue.run("daily", request, 2500);
		await vi.advanceTimersByTimeAsync(3600_000);
	}
	await expect(queue.run("daily", request, 3)).rejects.toMatchObject({
		status: 429,
	});
	expect(request).toHaveBeenCalledTimes(7);
});

it("stops queued requests after a successful response reports an exhausted budget", async () => {
	const queue = new SyncPdsRequests();
	const reset = String(Date.now() / 1000 + 3600);
	await queue.run("headers", async () =>
		Response.json(
			{},
			{ headers: { "ratelimit-remaining": "0", "ratelimit-reset": reset } },
		),
	);
	const request = vi.fn();
	await expect(queue.run("headers", request)).rejects.toMatchObject({
		retrySeconds: 3600,
	});
	expect(request).not.toHaveBeenCalled();
});

it("charges every authenticated batch record, including conservative puts", async () => {
	const run = vi
		.spyOn(syncPdsRequests, "run")
		.mockImplementation(async (_did, request) => request());
	const original = {
		did: "did:plc:batch",
		fetchHandler: vi.fn(async () => Response.json({})),
	};
	const session = await syncPdsSession(
		{ restore: async () => original } as never,
		original.did,
	);
	await session.fetchHandler("/xrpc/com.atproto.repo.applyWrites", {
		method: "POST",
		body: JSON.stringify({
			writes: [
				{ $type: "com.atproto.repo.applyWrites#create" },
				{ $type: "com.atproto.repo.applyWrites#delete" },
			],
		}),
	});
	expect(run.mock.calls.at(-1)?.[2]).toBe(4);
	await session.fetchHandler("/xrpc/com.atproto.repo.putRecord", {
		method: "POST",
		body: "{}",
	});
	expect(run.mock.calls.at(-1)?.[2]).toBe(3);
});
