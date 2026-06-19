import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { setupApiClient } from "./lib/api";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	// Point the shared API client at the configured base URL once, at the very
	// start of router creation. This runs at the top of every SSR request and
	// once on the client, so the base URL is correct before any route module
	// loads — no more order-dependent localhost fallback.
	setupApiClient();

	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
