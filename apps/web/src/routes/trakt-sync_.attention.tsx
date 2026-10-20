import { createFileRoute, redirect } from "@tanstack/react-router";
import { TraktSyncManager } from "#/components/trakt/TraktSyncManager";
import { ssrAuthOptions } from "#/lib/api";
import { currentUserQueryOptions, fetchCurrentUser } from "#/lib/auth-query";

export const Route = createFileRoute("/trakt-sync_/attention")({
	// Only the browser receives the API's host-only session cookie.
	ssr: false,
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
	head: () => ({ meta: [{ title: "Review sync items | Opnshelf" }] }),
	component: TraktSyncPage,
});
function TraktSyncPage() {
	return (
		<div className="container-app py-8 sm:py-12">
			<TraktSyncManager issuesOnly />
		</div>
	);
}
