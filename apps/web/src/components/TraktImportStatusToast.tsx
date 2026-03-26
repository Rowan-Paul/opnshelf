import {
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	isKnownTraktImportStatus,
	isTerminalTraktImportStatus,
	usersControllerGetMyCurrentTraktImportOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
	dismissTraktImportJob,
	loadDismissedTraktImportJobIds,
} from "@/lib/trakt-import-dismissal";

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
			return value && isActiveTraktImportStatus(value.status) ? 5_000 : false;
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
		if (isActiveTraktImportStatus(job.status)) {
			setDismissedJobId(null);
		}
	}, [job]);

	const statusMessage = job ? getTraktImportStatusMessage(job) : null;
	const progress = job ? getTraktImportStatusProgress(job) : null;
	const isKnownStatus = job ? isKnownTraktImportStatus(job.status) : false;
	const isTerminalJob = job ? isTerminalTraktImportStatus(job.status) : false;
	const isPersistentlyDismissed =
		job && isTerminalJob && dismissedTerminalJobIds.includes(job.id);

	if (
		!enabled ||
		!userDid ||
		!job ||
		!isKnownStatus ||
		!statusMessage ||
		dismissedJobId === job.id ||
		isPersistentlyDismissed ||
		(isTerminalJob && !isDismissalReady) ||
		!portalTarget
	) {
		return null;
	}

	const handleDismiss = () => {
		if (isActiveTraktImportStatus(job.status)) {
			setDismissedJobId(job.id);
			return;
		}

		if (!userDid || !isTerminalTraktImportStatus(job.status)) {
			setDismissedJobId(job.id);
			return;
		}

		setDismissedTerminalJobIds(dismissTraktImportJob(userDid, job.id));
	};

	return createPortal(
		<div className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 md:right-6 md:bottom-6 md:left-auto md:w-[360px]">
			<div className="pointer-events-auto w-full rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) p-4 shadow-lg">
				<div className="grid gap-3">
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
								{statusMessage}
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
					{progress !== null ? (
						<div className="grid gap-1">
							<div className="h-2 overflow-hidden rounded-full bg-(--md-sys-color-surface-container-highest)">
								<div
									className="h-full rounded-full bg-(--md-sys-color-primary) transition-[width] duration-300"
									style={{ width: `${progress}%` }}
								/>
							</div>
							<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
								{progress}% complete
							</p>
						</div>
					) : null}
				</div>
			</div>
		</div>,
		portalTarget,
	);
}
