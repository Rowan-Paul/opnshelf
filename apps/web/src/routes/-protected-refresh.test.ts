import { QueryClient } from "@tanstack/react-query";
import {
	type AnyRoute,
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	isRedirect,
} from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { Route as IntegrationRoute } from "./integrations.$provider";
import { Route as SettingsRoute } from "./settings";
import { Route as TraktRedirectRoute } from "./trakt-sync";

vi.mock("#/lib/api", () => ({ ssrAuthOptions: () => ({}) }));

// [route path, URL, route, params]
const routes: [string, string, AnyRoute, Record<string, string>][] = [
	[
		"/integrations/$provider",
		"/integrations/trakt",
		IntegrationRoute,
		{ provider: "trakt" },
	],
	["/settings", "/settings", SettingsRoute, {}],
];

it.each(
	routes,
)("keeps %s on refresh when SSR cannot see the API session", async (path, url, route) => {
	const queryClient = new QueryClient();
	const fetchQuery = vi
		.spyOn(queryClient, "fetchQuery")
		.mockRejectedValue({ status: 401 });
	const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({});
	const child = createRoute({
		...route.options,
		path,
		getParentRoute: () => root,
	});
	const router = createRouter({
		routeTree: root.addChildren([child]),
		context: { queryClient },
		history: createMemoryHistory({ initialEntries: [url] }),
		isServer: true,
	});
	try {
		await router.load();
		expect(router.state.location.pathname).toBe(url);
		expect(fetchQuery).not.toHaveBeenCalled();
	} finally {
		queryClient.clear();
	}
});

it.each(
	routes,
)("checks the browser session for %s before redirecting or rendering", async (_path, _url, route, params) => {
	const queryClient = new QueryClient();
	const fetchQuery = vi.spyOn(queryClient, "fetchQuery");
	const load = () =>
		route.options.beforeLoad?.({
			context: { queryClient },
			params,
		} as Parameters<NonNullable<typeof route.options.beforeLoad>>[0]);
	try {
		fetchQuery.mockResolvedValue({ did: "did:plc:test" });
		await expect(load()).resolves.toBeUndefined();
		expect(fetchQuery).toHaveBeenCalledWith(
			expect.objectContaining({ staleTime: 0, retry: false }),
		);
		fetchQuery.mockResolvedValue(null);
		await expect(load()).rejects.toSatisfy(
			(error: unknown) => isRedirect(error) && error.options.to === "/login",
		);
		const outage = new Error("API unavailable");
		fetchQuery.mockRejectedValue(outage);
		await expect(load()).rejects.toBe(outage);
	} finally {
		queryClient.clear();
	}
});

it("sends Trakt Sync's old address to the Trakt Integration, keeping the OAuth result", () => {
	let thrown: unknown;
	try {
		TraktRedirectRoute.options.beforeLoad?.({
			search: { connection: "failed" },
		} as unknown as Parameters<
			NonNullable<typeof TraktRedirectRoute.options.beforeLoad>
		>[0]);
	} catch (error) {
		thrown = error;
	}
	expect(isRedirect(thrown)).toBe(true);
	expect(
		isRedirect(thrown) && {
			to: thrown.options.to,
			params: thrown.options.params,
			search: thrown.options.search,
		},
	).toEqual({
		to: "/integrations/$provider",
		params: { provider: "trakt" },
		search: { connection: "failed" },
	});
});
