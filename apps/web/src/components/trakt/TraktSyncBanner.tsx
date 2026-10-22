import {
	traktSyncCatchUpMessage,
	traktSyncControllerStatus,
	traktSyncErrorMessage,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "#/lib/auth-context";
export function TraktSyncBanner() {
	const { isAuthenticated } = useAuth();
	// Shares Trakt Sync's status cache, so Settings changes show up here at once.
	const { data: sync } = useQuery({
		queryKey: ["trakt-sync", "status"],
		queryFn: async ({ signal }) =>
			(await traktSyncControllerStatus({ signal, throwOnError: true })).data,
		enabled: isAuthenticated,
		refetchInterval: (query) =>
			query.state.data?.status === "active" ||
			traktSyncCatchUpMessage(query.state.data)
				? 5000
				: false,
	});
	if (!isAuthenticated) return null;
	const syncMessage = traktSyncCatchUpMessage(sync);
	const syncError = traktSyncErrorMessage(sync);
	if (!syncMessage) return null;
	return (
		<Link
			to="/trakt-sync"
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
