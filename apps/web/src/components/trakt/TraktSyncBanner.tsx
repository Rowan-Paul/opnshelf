import {
	formatRetryCountdown,
	getRetryReason,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	usersControllerAcknowledgeMyTraktImportMutation,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMyCurrentTraktImportQueryKey,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "#/lib/auth-context";

/** Live "resuming in …" suffix for a budget-paused import. Ticks every 30s so
 *  the displayed wait counts down instead of showing the stale write-time. */
function PauseCountdown({ nextRunAt }: { nextRunAt: string }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(id);
	}, []);
	const remainingMs = new Date(nextRunAt).getTime() - now;
	return (
		<>
			{remainingMs > 1000
				? ` Resuming in ${formatRetryCountdown(remainingMs)}.`
				: " Resuming shortly…"}
		</>
	);
}

/**
 * Slim, site-wide indicator that a Trakt import is running in the background.
 * The import paces itself under the shared per-account PDS write budget, so a
 * large history can span hours or days — this keeps the user informed (and
 * reassured the site stays usable) wherever they are, not just on the import
 * screen. Renders nothing unless an authenticated user has an active job.
 * Mounted once in the root layout; the query polls only while a job is active.
 */
export function TraktSyncBanner() {
	const { isAuthenticated, user } = useAuth();
	const queryClient = useQueryClient();
	const { data: job } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: isAuthenticated,
		refetchInterval: (query) => {
			const current = query.state.data;
			return current && isActiveTraktImportStatus(current.status)
				? 5000
				: false;
		},
	});
	const acknowledge = useMutation({
		mutationKey: ["trakt", "import", "acknowledge"],
		...usersControllerAcknowledgeMyTraktImportMutation(),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
			}),
	});

	if (!isAuthenticated || !job) {
		return null;
	}
	const active = isActiveTraktImportStatus(job.status);
	const terminalNotice =
		!job.acknowledgedAt &&
		(job.status === "completed" || job.status === "failed");
	if (!active && !terminalNotice) return null;

	if (!active) {
		const hasUnmatched = job.unmatchedGroups.length > 0;
		const hasIssues = hasUnmatched || job.couldntImportCount > 0;
		const stopped = job.status === "failed";
		const label = stopped
			? "Your Trakt import stopped before all history was processed."
			: hasUnmatched
				? `Your Trakt import completed with ${job.unmatchedGroups.length} ${job.unmatchedGroups.length === 1 ? "title" : "titles"} to match.`
				: hasIssues
					? `Your Trakt import completed with ${job.couldntImportCount} ${job.couldntImportCount === 1 ? "item" : "items"} that couldn’t be imported.`
					: "Your Trakt import is complete.";
		return (
			<div className="border-(--border) border-b bg-(--background-subtle)">
				<div className="container-app flex items-center gap-3 py-2 text-sm">
					{stopped || hasIssues ? (
						<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					) : (
						<CheckCircle2 className="size-4 shrink-0 text-green-600" />
					)}
					<span className="min-w-0 flex-1 text-(--foreground-muted)">
						{label}
					</span>
					{!stopped && !hasIssues && user?.handle ? (
						<Link
							to="/profile/$handle/shelf"
							params={{ handle: user.handle }}
							onClick={() => acknowledge.mutate({})}
							className="font-medium text-(--accent) hover:underline"
						>
							View your Shelf
						</Link>
					) : (
						<Link
							to="/trakt-import"
							onClick={() => acknowledge.mutate({})}
							className="font-medium text-(--accent) hover:underline"
						>
							{hasUnmatched ? "Match titles" : "Review result"}
						</Link>
					)}
					<button
						type="button"
						onClick={() => acknowledge.mutate({})}
						aria-label="Dismiss Trakt import result"
						className="rounded-md p-1 text-(--foreground-muted) hover:bg-(--background-elevated)"
					>
						<X className="size-4" />
					</button>
				</div>
			</div>
		);
	}

	const progress = getTraktImportStatusProgress(job);
	const waiting = job.status === "waiting_retry";
	const reason = waiting ? getRetryReason(job.lastError) : undefined;

	return (
		<Link
			to="/trakt-import"
			className="block border-(--border) border-b bg-(--background-subtle) hover:bg-(--background-elevated)"
		>
			<div className="container-app flex items-center gap-2 py-2 text-(--foreground-muted) text-sm">
				<Loader2 className="size-4 shrink-0 animate-spin" />
				<span className="min-w-0 flex-1">
					Importing your Trakt history in the background
					{progress !== null ? ` — ${progress}%` : ""}
					{waiting ? (
						<>
							{". "}
							{reason ?? "Paused to keep your account under its write limit."}
							{job.nextRunAt ? (
								<PauseCountdown nextRunAt={job.nextRunAt} />
							) : null}
						</>
					) : (
						". You can keep using the site as usual."
					)}
				</span>
			</div>
		</Link>
	);
}
