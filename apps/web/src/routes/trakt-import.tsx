import { createFileRoute, redirect } from "@tanstack/react-router";
import { TraktImportManager } from "#/components/trakt/TraktImportManager";
import { ssrAuthOptions } from "#/lib/api";
import { currentUserQueryOptions, fetchCurrentUser } from "#/lib/auth-query";

export const Route = createFileRoute("/trakt-import")({
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
				search: { message: "Please log in to import from Trakt" },
			});
	},
	head: () => ({ meta: [{ title: "Import from Trakt | Opnshelf" }] }),
	component: TraktImportPage,
});

function TraktImportPage() {
	return (
		<div className="container-app py-8 sm:py-12">
			<TraktImportManager />
		</div>
	);
}
