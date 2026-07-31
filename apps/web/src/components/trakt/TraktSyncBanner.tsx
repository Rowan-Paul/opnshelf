import {
	formatRetryCountdown,
	getRetryReason,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	usersControllerGetMyCurrentTraktImportOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
	const { isAuthenticated } = useAuth();
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

	if (!isAuthenticated || !job || !isActiveTraktImportStatus(job.status)) {
		return null;
	}

	const progress = getTraktImportStatusProgress(job);
	const waiting = job.status === "waiting_retry";
	const reason = waiting ? getRetryReason(job.lastError) : undefined;

	return (
		<div className="border-(--border) border-b bg-(--background-subtle)">
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
		</div>
	);
}
