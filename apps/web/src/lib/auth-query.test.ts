import { authControllerMe } from "@opnshelf/api";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
	currentUserQueryOptions,
	fetchCurrentUser,
	SESSION_CHECK_DEADLINE_MS,
} from "./auth-query";

vi.mock("@opnshelf/api", () => ({
	authControllerMe: vi.fn(),
	authControllerMeOptions: () => ({ queryKey: ["auth"] }),
	isUnauthorizedError: (e: { status?: number }) => e.status === 401,
}));
describe("current user query", () => {
	it("times out a guarded check after the auth provider disconnects", async () => {
		vi.useFakeTimers();
		const me = vi.mocked(authControllerMe);
		let signal: AbortSignal | undefined;
		me.mockImplementationOnce(
			(options) =>
				new Promise<never>((_, reject) => {
					signal = options?.signal ?? undefined;
					signal?.addEventListener("abort", () => reject(signal?.reason));
				}),
		);
		const client = new QueryClient();
		try {
			const options = currentUserQueryOptions();
			const provider = new QueryObserver(client, options);
			const unsubscribe = provider.subscribe(() => {});
			const outcome = fetchCurrentUser(client, options).catch(
				(error: unknown) => error,
			);
			unsubscribe();
			await vi.advanceTimersByTimeAsync(SESSION_CHECK_DEADLINE_MS - 1);
			expect(signal?.aborted).toBe(false);
			await vi.advanceTimersByTimeAsync(1);
			expect(signal?.aborted).toBe(true);
			expect(await outcome).toMatchObject({
				name: "TimeoutError",
				message: "Session check timed out",
			});
			expect(me).toHaveBeenCalledTimes(1);
			expect(client.getQueryData(options.queryKey)).toBeUndefined();
			expect(
				client
					.getQueryCache()
					.find({ queryKey: options.queryKey })
					?.getObserversCount(),
			).toBe(0);
		} finally {
			client.clear();
			me.mockReset();
			vi.useRealTimers();
		}
	});
	it("keeps a route's session check alive when the auth provider disconnects", async () => {
		const me = vi.mocked(authControllerMe);
		const user = { did: "benchmark" };
		let finish!: () => void;
		me.mockImplementationOnce(async () => {
			await new Promise<void>((resolve) => {
				finish = resolve;
			});
			return { data: user } as Awaited<
				ReturnType<typeof authControllerMe<true>>
			>;
		});
		const client = new QueryClient();
		const options = currentUserQueryOptions();
		const provider = new QueryObserver(client, options);
		const unsubscribe = provider.subscribe(() => {});
		const guarded = fetchCurrentUser(client, options);
		// React disconnects provider subscriptions while a route is suspended.
		unsubscribe();
		finish();
		await expect(guarded).resolves.toEqual(user);
		expect(
			client
				.getQueryCache()
				.find({ queryKey: options.queryKey })
				?.getObserversCount(),
		).toBe(0);
		client.clear();
		me.mockReset();
	});
	it.each([
		"cancel",
		"clear",
	])("still aborts a guarded check on explicit %s", async (action) => {
		const me = vi.mocked(authControllerMe);
		let signal: AbortSignal | undefined;
		me.mockImplementationOnce(
			(options) =>
				new Promise<never>((_, reject) => {
					signal = options?.signal ?? undefined;
					signal?.addEventListener("abort", () => reject(signal?.reason));
				}),
		);
		const client = new QueryClient();
		const options = currentUserQueryOptions();
		const guarded = fetchCurrentUser(client, options);
		const rejected = expect(guarded).rejects.toThrow("CancelledError");
		if (action === "clear") client.clear();
		else await client.cancelQueries({ queryKey: options.queryKey });
		await rejected;
		expect(signal?.aborted).toBe(true);
		expect(client.getQueryData(options.queryKey)).toBeUndefined();
		client.clear();
		me.mockReset();
	});
	it("reuses auth for navigation and refreshes after invalidation", async () => {
		const me = vi.mocked(authControllerMe);
		me.mockResolvedValue({ data: { did: "benchmark" } } as Awaited<
			ReturnType<typeof authControllerMe>
		>);
		const client = new QueryClient();
		for (let i = 0; i < 20; i++)
			await client.fetchQuery(currentUserQueryOptions());
		expect(me).toHaveBeenCalledTimes(1);
		await client.invalidateQueries({
			queryKey: currentUserQueryOptions().queryKey,
		});
		await client.fetchQuery(currentUserQueryOptions());
		expect(me).toHaveBeenCalledTimes(2);
		client.clear();
		me.mockReset();
	});
	it("caches signed-out state without swallowing server errors", async () => {
		const me = vi.mocked(authControllerMe);
		me.mockRejectedValue({ status: 401 });
		const client = new QueryClient();
		expect(await client.fetchQuery(currentUserQueryOptions())).toBeNull();
		expect(await client.fetchQuery(currentUserQueryOptions())).toBeNull();
		expect(me).toHaveBeenCalledTimes(1);
		me.mockRejectedValue(new Error("unavailable"));
		await client.invalidateQueries();
		await expect(client.fetchQuery(currentUserQueryOptions())).rejects.toThrow(
			"unavailable",
		);
		client.clear();
		me.mockReset();
	});
});
