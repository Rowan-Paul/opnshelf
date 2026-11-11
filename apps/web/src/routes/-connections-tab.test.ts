import { QueryClient } from "@tanstack/react-query";
import {
	type AnyRoute,
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { Route as ConnectionsRoute } from "./profile.$handle/connections";

const connectionsRoute: AnyRoute = ConnectionsRoute;

async function loadConnections(search: string) {
	const queryClient = new QueryClient();
	vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue({
		did: "did:plc:test",
		handle: "alice.test",
	});
	const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({});
	const child = createRoute({
		...connectionsRoute.options,
		path: "/profile/$handle/connections",
		getParentRoute: () => root,
	});
	const router = createRouter({
		routeTree: root.addChildren([child]),
		context: { queryClient },
		history: createMemoryHistory({
			initialEntries: [`/profile/alice.test/connections${search}`],
		}),
	});
	try {
		await router.load();
		const match = router.state.matches.find((m) => m.routeId === child.id);
		return { status: match?.status, search: match?.search };
	} finally {
		queryClient.clear();
	}
}

it.each([
	["", "followers"],
	["?tab=followers", "followers"],
	["?tab=following", "following"],
])("opens %s on the requested list", async (search, tab) => {
	await expect(loadConnections(search)).resolves.toEqual({
		status: "success",
		search: { tab },
	});
});

it.each([
	"?tab=666551485",
	"?tab=unknown",
	"?tab=",
	"?tab=true",
	"?tab=%5B%22following%22%5D",
	"?tab=%7B%22a%22%3A1%7D",
])("falls back to Followers for the invalid tab in %s", async (search) => {
	await expect(loadConnections(search)).resolves.toEqual({
		status: "success",
		search: { tab: "followers" },
	});
});
