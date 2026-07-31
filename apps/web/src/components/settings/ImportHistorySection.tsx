import {
	isActiveTraktImportStatus,
	type TraktImportJobDto,
	usersControllerGetMyCurrentTraktImportOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Download } from "lucide-react";
import { useAuth } from "#/lib/auth-context";

function getTraktSettingsLabel(job?: TraktImportJobDto | null): string {
	if (!job) return "Import from Trakt";
	if (job.status === "paused" || job.status === "failed") {
		return "Resume Trakt import";
	}
	if (isActiveTraktImportStatus(job.status)) {
		return "Trakt import in progress";
	}
	if (job.unmatchedGroups.length > 0) {
		return `Match ${job.unmatchedGroups.length} ${job.unmatchedGroups.length === 1 ? "title" : "titles"}`;
	}
	return "View Trakt import";
}

export function ImportHistorySection() {
	const { isAuthenticated } = useAuth();
	const { data: traktImport } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: isAuthenticated,
	});

	return (
		<section
			id="import-history"
			className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
		>
			<h2 className="mb-1 font-semibold text-lg">Import history</h2>
			<p className="mb-5 text-(--foreground-muted) text-sm">
				Bring your public Trakt watch history into your Shelf
			</p>
			<Link
				to="/trakt-import"
				className="flex max-w-lg items-center gap-3 rounded-xl border border-(--border) bg-(--background-subtle) p-4 transition-colors hover:bg-(--background-elevated)"
			>
				<Download className="size-5 text-(--accent)" />
				<div className="min-w-0 flex-1">
					<p className="font-medium">{getTraktSettingsLabel(traktImport)}</p>
					{traktImport ? (
						<p className="mt-0.5 text-(--foreground-muted) text-xs">
							@{traktImport.profileUsername ?? traktImport.traktUsername}
						</p>
					) : null}
				</div>
				<ChevronRight className="size-4 text-(--foreground-muted)" />
			</Link>
		</section>
	);
}
