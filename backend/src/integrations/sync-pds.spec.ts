import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Agent } from "@atproto/api";
import { PdsRequestError } from "../common/pds-request-error";
import { SyncPdsRequests, syncPdsFailure, syncPdsSession } from "./sync-pds";
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
	).rejects.toBe(failure);
	const restore = vi.fn();
	await expect(
		syncPdsSession({ restore }, "limited-owner"),
	).rejects.toMatchObject({ retrySeconds: 900 });
	expect(restore).not.toHaveBeenCalled();
});
