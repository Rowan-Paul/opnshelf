import { createFileRoute, redirect } from "@tanstack/react-router";
import { TraktSyncManager } from "#/components/trakt/TraktSyncManager";
import { ssrAuthOptions } from "#/lib/api";
import { currentUserQueryOptions, fetchCurrentUser } from "#/lib/auth-query";

export const Route = createFileRoute("/trakt-sync")({
	// Only the browser receives the API's host-only session cookie.
	ssr: false,
	validateSearch: (
		search: Record<string, unknown>,
	): { connection?: string } => ({
		connection:
			typeof search.connection === "string" ? search.connection : undefined,
	}),
	beforeLoad: async ({ context }) => {
		const user = await fetchCurrentUser(context.queryClient, {
			...currentUserQueryOptions(ssrAuthOptions()),
			// Recheck the signed-out placeholder hydrated from the root's SSR.
			staleTime: 0,
		});
		if (!user)
			throw redirect({
				to: "/login",
				search: { message: "Please log in to manage Trakt Sync" },
			});
	},
	head: () => ({ meta: [{ title: "Trakt Sync | Opnshelf" }] }),
	component: TraktSyncPage,
});
function TraktSyncPage() {
	const { connection } = Route.useSearch();
	return (
		<div className="container-app py-8 sm:py-12">
			<TraktSyncManager connectionFailed={connection === "failed"} />
		</div>
	);
}
