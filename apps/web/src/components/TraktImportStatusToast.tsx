import { usersControllerGetMyCurrentTraktImportOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
	dismissTraktImportJob,
	loadDismissedTraktImportJobIds,
} from "@/lib/trakt-import-dismissal";

const ACTIVE_STATUSES = ["queued", "running", "waiting_retry"] as const;
const TERMINAL_STATUSES = ["completed", "failed"] as const;

type TraktImportStatusToastProps = {
	enabled: boolean;
	userDid?: string;
};

export function TraktImportStatusToast({
	enabled,
	userDid,
}: TraktImportStatusToastProps) {
	const [dismissedJobId, setDismissedJobId] = useState<string | null>(null);
	const [dismissedTerminalJobIds, setDismissedTerminalJobIds] = useState<
		string[]
	>([]);
	const [isDismissalReady, setIsDismissalReady] = useState(false);
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
	const { data: job } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled,
		retry: false,
		staleTime: 0,
		refetchInterval: (query) => {
			const value = query.state.data;
			return value && isActiveStatus(value.status) ? 5_000 : false;
		},
	});

	useEffect(() => {
		setPortalTarget(document.body);
	}, []);

	useEffect(() => {
		if (!userDid) {
			setDismissedTerminalJobIds([]);
			setIsDismissalReady(true);
			return;
		}

		setDismissedTerminalJobIds(loadDismissedTraktImportJobIds(userDid));
		setIsDismissalReady(true);
	}, [userDid]);

	useEffect(() => {
		if (!job) {
			setDismissedJobId(null);
			return;
		}
		if (isActiveStatus(job.status)) {
			setDismissedJobId(null);
		}
	}, [job]);

	const isTerminalJob = job ? isTerminalStatus(job.status) : false;
	const isPersistentlyDismissed =
		job && isTerminalJob && dismissedTerminalJobIds.includes(job.id);

	if (
		!job ||
		dismissedJobId === job.id ||
		isPersistentlyDismissed ||
		(isTerminalJob && !isDismissalReady) ||
		!portalTarget
	) {
		return null;
	}

	const handleDismiss = () => {
		if (isActiveStatus(job.status)) {
			setDismissedJobId(job.id);
			return;
		}

		if (!userDid || !isTerminalStatus(job.status)) {
			setDismissedJobId(job.id);
			return;
		}

		setDismissedTerminalJobIds(dismissTraktImportJob(userDid, job.id));
	};

	return createPortal(
		<div className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 md:right-6 md:bottom-6 md:left-auto md:w-[360px]">
			<div className="pointer-events-auto w-full rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) p-4 shadow-lg">
				<div className="flex items-start justify-between gap-3">
					<div className="grid gap-1">
						<p className="md-label-small m-0 uppercase tracking-[0.12em] text-(--md-sys-color-primary)">
							Trakt import
						</p>
						<p className="md-title-medium m-0">
							{job.profileUsername
								? `@${job.profileUsername}`
								: job.traktUsername}
						</p>
						<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
							{getStatusMessage(job)}
						</p>
					</div>
					<button
						type="button"
						className="rounded-full border border-(--md-sys-color-outline-variant) px-2 py-1 text-xs text-(--md-sys-color-on-surface-variant)"
						onClick={handleDismiss}
					>
						Dismiss
					</button>
				</div>
			</div>
		</div>,
		portalTarget,
	);
}

function isActiveStatus(status: string): boolean {
	return ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]);
}

function isTerminalStatus(status: string): boolean {
	return TERMINAL_STATUSES.includes(
		status as (typeof TERMINAL_STATUSES)[number],
	);
}

function getStatusMessage(job: {
	status: string;
	currentPage: number;
	totalPages?: number;
	importedCount: number;
	skippedCount: number;
	failedCount: number;
	lastError?: string;
}): string {
	if (job.status === "queued") {
		return "Queued on the server. We’ll keep importing your full watch history in the background.";
	}
	if (job.status === "waiting_retry") {
		return (
			job.lastError ?? "Waiting for Trakt rate limits to reset before retrying."
		);
	}
	if (job.status === "running") {
		const pageLabel = job.totalPages
			? `Page ${job.currentPage} of ${job.totalPages}`
			: `Page ${job.currentPage}`;
		return `${pageLabel}. Imported ${job.importedCount}, skipped ${job.skippedCount}, failed ${job.failedCount}.`;
	}
	if (job.status === "completed") {
		return `Finished. Imported ${job.importedCount}, skipped ${job.skippedCount}, failed ${job.failedCount}.`;
	}
	return job.lastError ?? "Import failed. You can retry from onboarding later.";
}
