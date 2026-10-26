import {
	type AccountDeletionJobDto,
	getAccountDeletionProgress,
	getAccountDeletionStatusMessage,
} from "@opnshelf/api";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

/** Split from the gate so Radix Dialog stays off every page's first load. */
export default function AccountDeletionDialog({
	job,
}: {
	job: AccountDeletionJobDto;
}) {
	const progress = getAccountDeletionProgress(job);

	return (
		<Dialog open>
			<DialogContent
				showCloseButton={false}
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
				className="sm:max-w-[425px]"
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
						<AlertTriangle className="size-5" />
						Deleting your account
					</DialogTitle>
					<DialogDescription>
						This keeps running on our side if you close the page. You'll be
						signed out when it's done.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="flex items-center gap-2 text-red-800 dark:text-red-200">
						<Loader2 className="size-4 animate-spin" />
						<span className="font-medium text-sm">
							{getAccountDeletionStatusMessage(job)}
						</span>
					</div>
					{progress !== null && (
						<div
							role="progressbar"
							aria-label="Account deletion progress"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={progress}
							className="h-2 w-full overflow-hidden rounded-full bg-red-200 dark:bg-red-900"
						>
							<div
								className="h-full rounded-full bg-red-600 transition-all dark:bg-red-400"
								style={{ width: `${progress}%` }}
							/>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
