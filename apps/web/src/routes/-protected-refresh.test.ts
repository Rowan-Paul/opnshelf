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
import { Route as SettingsRoute } from "./settings";
import { Route as SyncRoute } from "./trakt-sync";

vi.mock("#/lib/api", () => ({ ssrAuthOptions: () => ({}) }));

const routes: [string, AnyRoute][] = [
	["/trakt-sync", SyncRoute],
	["/settings", SettingsRoute],
];

it.each(
	routes,
)("keeps %s on refresh when SSR cannot see the API session", async (path, route) => {
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
		history: createMemoryHistory({ initialEntries: [path] }),
		isServer: true,
	});
	try {
		await router.load();
		expect(router.state.location.pathname).toBe(path);
		expect(fetchQuery).not.toHaveBeenCalled();
	} finally {
		queryClient.clear();
	}
});

it.each(
	routes,
)("checks the browser session for %s before redirecting or rendering", async (_path, route) => {
	const queryClient = new QueryClient();
	const fetchQuery = vi.spyOn(queryClient, "fetchQuery");
	const load = () =>
		route.options.beforeLoad?.({ context: { queryClient } } as Parameters<
			NonNullable<typeof route.options.beforeLoad>
		>[0]);
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
