import { authControllerMe } from "@opnshelf/api";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { currentUserQueryOptions } from "./auth-query";

vi.mock("@opnshelf/api", () => ({
	authControllerMe: vi.fn(),
	authControllerMeOptions: () => ({ queryKey: ["auth"] }),
	isUnauthorizedError: (e: { status?: number }) => e.status === 401,
}));
describe("current user query", () => {
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
