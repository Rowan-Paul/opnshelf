import { findIntegration } from "@opnshelf/api";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { IntegrationSyncManager } from "#/components/integrations/IntegrationSyncManager";
import { usePermissionChangeResult } from "#/components/settings/use-settings-mutations";
import { ssrAuthOptions } from "#/lib/api";
import { currentUserQueryOptions, fetchCurrentUser } from "#/lib/auth-query";
import { ONBOARDING_INTEGRATION } from "#/lib/onboarding-steps";

export const Route = createFileRoute("/integrations/$provider")({
	// Only the browser receives the API's host-only session cookie.
	ssr: false,
	validateSearch: (
		search: Record<string, unknown>,
	): { connection?: string; permission?: string } => ({
		connection:
			typeof search.connection === "string" ? search.connection : undefined,
		permission:
			typeof search.permission === "string" ? search.permission : undefined,
	}),
	beforeLoad: async ({ context, params, search }) => {
		const integration = findIntegration(params.provider);
		if (!integration) throw notFound();
		const user = await fetchCurrentUser(context.queryClient, {
			...currentUserQueryOptions(ssrAuthOptions()),
			// Recheck the signed-out placeholder hydrated from the root's SSR.
			staleTime: 0,
		});
		if (!user)
			throw redirect({
				to: "/login",
				search: { message: `Please log in to manage ${integration.name} Sync` },
			});
		// A write grant asked for during onboarding comes back here when it is
		// declined; onboarding resumes at this Integration and says so.
		if (
			user.needsOnboarding &&
			sessionStorage.getItem(ONBOARDING_INTEGRATION) === integration.id
		)
			throw redirect({
				to: "/onboarding",
				search: search.permission ? { permission: search.permission } : {},
			});
	},
	head: ({ params }) => ({
		meta: [
			{
				title: `${findIntegration(params.provider)?.name ?? "Integration"} Sync | Opnshelf`,
			},
		],
	}),
	component: IntegrationPage,
});
function IntegrationPage() {
	const { provider } = Route.useParams();
	const { connection } = Route.useSearch();
	usePermissionChangeResult(true);
	const integration = findIntegration(provider);
	if (!integration) return null;
	return (
		<div className="container-app py-8 sm:py-12">
			<IntegrationSyncManager
				key={integration.id}
				integration={integration}
				connectionFailed={connection === "failed"}
			/>
		</div>
	);
}
