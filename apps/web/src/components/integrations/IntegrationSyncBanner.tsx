import {
	INTEGRATIONS,
	integrationBanner,
	integrationCatchUpMessage,
	integrationKey,
} from "@opnshelf/api";
import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "#/lib/auth-context";

/** Site-wide strip for whichever Integration needs the User or is catching up. */
export function IntegrationSyncBanner() {
	const { isAuthenticated } = useAuth();
	// Shares each Integration's status cache, so Settings changes show up here at once.
	const statuses = useQueries({
		queries: INTEGRATIONS.map((integration) => ({
			queryKey: [...integrationKey(integration), "status"],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				integration.api.status(signal),
			enabled: isAuthenticated,
			refetchInterval: (query: {
				state: { data?: Awaited<ReturnType<typeof integration.api.status>> };
			}) =>
				query.state.data?.status === "active" ||
				integrationCatchUpMessage(query.state.data, integration.name)
					? 5000
					: (false as const),
		})),
	});
	if (!isAuthenticated) return null;
	const banner = integrationBanner(statuses.map((status) => status.data));
	if (!banner) return null;
	const { message: syncMessage, error: syncError } = banner;
	return (
		<Link
			to="/integrations/$provider"
			params={{ provider: banner.integration.id }}
			search={{}}
			className={`block border-b ${syncError ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" : "border-(--border) bg-(--background-subtle) text-(--foreground-muted)"}`}
		>
			<div className="container-app flex items-center gap-2 py-2 text-sm">
				{syncError ? (
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
				) : (
					<Loader2 className="size-4 shrink-0 animate-spin" />
				)}
				<span className="min-w-0 flex-1">
					{syncMessage}.{" "}
					<span className="font-semibold underline underline-offset-4">
						View details
					</span>
				</span>
			</div>
		</Link>
	);
}
