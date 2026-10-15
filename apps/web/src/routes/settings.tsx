import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ssrAuthOptions } from "#/lib/api";
import { currentUserQueryOptions } from "#/lib/auth-query";

export const Route = createFileRoute("/settings")({
	// Only the browser receives the API's host-only session cookie.
	ssr: false,
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.fetchQuery({
			...currentUserQueryOptions(ssrAuthOptions()),
			// Recheck the signed-out placeholder hydrated from the root's SSR.
			staleTime: 0,
		});
		if (!user)
			throw redirect({
				to: "/login",
				search: { message: "Please log in to view settings" },
			});
	},
	head: () => ({
		meta: [{ title: "Settings | Opnshelf" }],
	}),
	component: Outlet,
});
