import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { Route } from "../routes/pick-for-me";

vi.mock("#/lib/api", () => ({
	ssrAuthOptions: () => ({}),
	ssrCanResolveSession: () => true,
}));

it("redirects a confirmed signed-out visitor to login", async () => {
	const queryClient = new QueryClient();
	vi.spyOn(queryClient, "fetchQuery").mockResolvedValue(null);
	await expect(
		Route.options.beforeLoad?.({
			context: { queryClient },
		} as Parameters<NonNullable<typeof Route.options.beforeLoad>>[0]),
	).rejects.toSatisfy((error: unknown) => {
		return isRedirect(error) && error.options.to === "/login";
	});
	queryClient.clear();
});
