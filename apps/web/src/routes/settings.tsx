import { authControllerMeOptions, isUnauthorizedError } from "@opnshelf/api";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ssrAuthOptions } from "#/lib/api";

export const Route = createFileRoute("/settings")({
	beforeLoad: async ({ context }) => {
		try {
			await context.queryClient.fetchQuery(
				authControllerMeOptions(ssrAuthOptions()),
			);
		} catch (error) {
			if (isUnauthorizedError(error)) {
				throw redirect({
					to: "/login",
					search: { message: "Please log in to view settings" },
				});
			}
			throw error;
		}
	},
	head: () => ({
		meta: [{ title: "Settings | Opnshelf" }],
	}),
	component: Outlet,
});
