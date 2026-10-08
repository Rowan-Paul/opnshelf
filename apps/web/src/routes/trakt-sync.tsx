import { authControllerMeOptions, isUnauthorizedError } from "@opnshelf/api";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { TraktSyncManager } from "#/components/trakt/TraktSyncManager";
import { ssrAuthOptions } from "#/lib/api";

export const Route = createFileRoute("/trakt-sync")({
	beforeLoad: async ({ context }) => {
		try {
			await context.queryClient.fetchQuery(
				authControllerMeOptions(ssrAuthOptions()),
			);
		} catch (error) {
			if (isUnauthorizedError(error))
				throw redirect({
					to: "/login",
					search: { message: "Please log in to manage Trakt Sync" },
				});
			throw error;
		}
	},
	head: () => ({ meta: [{ title: "Trakt Sync | Opnshelf" }] }),
	component: () => (
		<div className="container-app py-8 sm:py-12">
			<TraktSyncManager />
		</div>
	),
});
