import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "./__root";

vi.mock("#/lib/api", () => ({
	ssrAuthOptions: () => ({}),
	ssrCanResolveSession: () => true,
}));
vi.mock("#/lib/session-hint", () => ({
	mayBeSignedIn: () => true,
	SIGNED_IN_HINT_QUERY_KEY: ["session-hint"],
}));

const clients: QueryClient[] = [];
afterEach(() => {
	for (const client of clients) client.clear();
	clients.length = 0;
});

async function loadWithSessionResult(result: unknown) {
	const queryClient = new QueryClient();
	clients.push(queryClient);
	const fetchQuery = vi.spyOn(queryClient, "fetchQuery");
	if (result instanceof Error) fetchQuery.mockRejectedValue(result);
	else fetchQuery.mockResolvedValue(result);
	await Route.options.beforeLoad?.({
		context: { queryClient },
		location: { pathname: "/shows/123/example" },
	} as Parameters<NonNullable<typeof Route.options.beforeLoad>>[0]);
	return fetchQuery;
}

it.each([
	Object.assign(new Error("Too Many Requests"), { status: 429 }),
	new Error("fetch failed"),
])("keeps the public page available when the SSR session check fails: %s", async (error) => {
	const fetchQuery = await loadWithSessionResult(error);
	expect(fetchQuery).toHaveBeenCalledOnce();
});

it("still redirects a verified user who needs onboarding", async () => {
	await expect(
		loadWithSessionResult({ needsOnboarding: true }),
	).rejects.toSatisfy(isRedirect);
});
