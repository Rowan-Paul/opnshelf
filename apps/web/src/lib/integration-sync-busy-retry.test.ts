import {
	configureApiClient,
	integrationSyncBusyRetry,
	POPFEED_INTEGRATION,
	TRAKT_INTEGRATION,
	usersControllerDeleteMyAccountMutation,
} from "@opnshelf/api";
import {
	MutationCache,
	MutationObserver,
	QueryClient,
} from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

it.each([
	POPFEED_INTEGRATION,
	TRAKT_INTEGRATION,
])("retries a busy $name save with the confirmed settings and reports no terminal error", async (integration) => {
	vi.useFakeTimers();
	configureApiClient("http://fixture.test");
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(
			Response.json(
				{
					statusCode: 409,
					code: "SYNC_BUSY",
					message: "Sync is finishing its current operation.",
				},
				{ status: 409 },
			),
		)
		.mockResolvedValueOnce(Response.json({ status: "active" }));
	vi.stubGlobal("fetch", fetch);
	const onError = vi.fn();
	const client = new QueryClient({
		mutationCache: new MutationCache({ onError }),
	});
	const observer = new MutationObserver(client, {
		mutationFn: integration.api.configure,
		...integrationSyncBusyRetry,
	});
	const unsubscribe = observer.subscribe(() => {});
	const settings = {
		direction: "inbound" as const,
		historyScope: "all" as const,
		watches: true,
		ratings: false,
		publicationConsent: true,
	};
	const saved = observer.mutate(settings);
	await vi.advanceTimersByTimeAsync(0);
	expect(observer.getCurrentResult()).toMatchObject({
		status: "pending",
		failureCount: 1,
	});
	expect(onError).not.toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(2000);
	await expect(saved).resolves.toMatchObject({ status: "active" });
	expect(fetch).toHaveBeenCalledTimes(2);
	const requests = fetch.mock.calls.map(([request]) => request as Request);
	expect(await requests[0].json()).toEqual(settings);
	expect(await requests[1].json()).toEqual(settings);
	expect(onError).not.toHaveBeenCalled();
	unsubscribe();
	client.clear();
});

it.each([
	{
		name: "action",
		run: () => POPFEED_INTEGRATION.api.action("pause"),
		body: { action: "pause" },
		path: "/popfeed-sync/action",
	},
	{
		name: "issue resolution",
		run: () =>
			POPFEED_INTEGRATION.api.resolve("fixture-item", { action: "link" }),
		body: { action: "link" },
		path: "/popfeed-sync/issues/fixture-item",
	},
])("retries a busy $name request with the same body", async ({
	run,
	body,
	path,
}) => {
	vi.useFakeTimers();
	configureApiClient("http://fixture.test");
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(
			Response.json(
				{
					statusCode: 409,
					code: "SYNC_BUSY",
					message: "Sync is finishing its current operation.",
				},
				{ status: 409 },
			),
		)
		.mockResolvedValueOnce(Response.json({ status: "paused" }));
	vi.stubGlobal("fetch", fetch);
	const onError = vi.fn();
	const client = new QueryClient({
		mutationCache: new MutationCache({ onError }),
	});
	const observer = new MutationObserver(client, {
		mutationFn: run,
		...integrationSyncBusyRetry,
	});
	const done = observer.mutate();
	await vi.advanceTimersByTimeAsync(0);
	expect(observer.getCurrentResult()).toMatchObject({
		status: "pending",
		failureCount: 1,
	});
	await vi.advanceTimersByTimeAsync(2000);
	await expect(done).resolves.toMatchObject({ status: "paused" });
	const requests = fetch.mock.calls.map(([request]) => request as Request);
	expect(requests).toHaveLength(2);
	for (const request of requests) {
		expect(new URL(request.url).pathname).toBe(path);
		expect(await request.json()).toEqual(body);
	}
	expect(onError).not.toHaveBeenCalled();
	client.clear();
});

it("retries a busy account deletion with the same choice", async () => {
	vi.useFakeTimers();
	configureApiClient("http://fixture.test");
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(
			Response.json(
				{ statusCode: 409, code: "SYNC_BUSY", message: "Busy" },
				{ status: 409 },
			),
		)
		.mockResolvedValueOnce(new Response(null, { status: 204 }));
	vi.stubGlobal("fetch", fetch);
	const onError = vi.fn();
	const client = new QueryClient({
		mutationCache: new MutationCache({ onError }),
	});
	const observer = new MutationObserver(client, {
		...usersControllerDeleteMyAccountMutation(),
		...integrationSyncBusyRetry,
	});
	const done = observer.mutate({ body: { deletePDSData: false } });
	await vi.advanceTimersByTimeAsync(2000);
	await done;
	const requests = fetch.mock.calls.map(([request]) => request as Request);
	expect(requests).toHaveLength(2);
	for (const request of requests) {
		expect(request.method).toBe("DELETE");
		expect(await request.json()).toEqual({ deletePDSData: false });
	}
	expect(onError).not.toHaveBeenCalled();
	client.clear();
});

it("stops after sixty seconds of busy retry waits and reports one terminal error", async () => {
	vi.useFakeTimers();
	const busy = { statusCode: 409, code: "SYNC_BUSY" };
	const save = vi.fn().mockRejectedValue(busy);
	const onError = vi.fn();
	const client = new QueryClient({
		mutationCache: new MutationCache({ onError }),
	});
	const observer = new MutationObserver(client, {
		mutationFn: save,
		...integrationSyncBusyRetry,
	});
	const unsubscribe = observer.subscribe(() => {});
	const result = observer.mutate({ watches: true }).catch((error) => error);
	await vi.advanceTimersByTimeAsync(59_999);
	expect(save).toHaveBeenCalledTimes(30);
	expect(observer.getCurrentResult().status).toBe("pending");
	await vi.advanceTimersByTimeAsync(1);
	expect(await result).toBe(busy);
	expect(save).toHaveBeenCalledTimes(31);
	expect(onError).toHaveBeenCalledOnce();
	unsubscribe();
	client.clear();
});

it.each([
	{ statusCode: 409, message: "Sync ownership changed. Try again." },
	{ statusCode: 409 },
	{ statusCode: 403, code: "SYNC_BUSY" },
	{ statusCode: 500 },
	new TypeError("Network failed"),
])("does not retry another error: %j", async (error) => {
	const save = vi.fn().mockRejectedValue(error);
	const client = new QueryClient();
	const observer = new MutationObserver(client, {
		mutationFn: save,
		...integrationSyncBusyRetry,
	});
	await expect(observer.mutate({})).rejects.toBe(error);
	expect(save).toHaveBeenCalledOnce();
	client.clear();
});
