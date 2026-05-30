import {
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isTerminalTraktImportStatus,
	type TraktImportJobDto,
} from "@opnshelf/api";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Status banner for an in-flight or finished Trakt import job: a progress bar
 * (when known) plus a human-readable status message. Uses the shared
 * `@opnshelf/api` status helpers so wording matches web.
 */
export function TraktImportBanner({ job }: { job: TraktImportJobDto }) {
	const progress = getTraktImportStatusProgress(job);
	const message = getTraktImportStatusMessage(job);
	const isDone = isTerminalTraktImportStatus(job.status);
	const isFailed = job.status === "failed";

	const Icon = isFailed ? TriangleAlert : isDone ? CheckCircle2 : Loader2;
	const iconColor = isFailed ? "#ef4444" : isDone ? "#22c55e" : "#f3bc00";

	return (
		<View className="gap-3 rounded-xl border border-border bg-card p-4">
			<View className="flex-row items-center gap-2">
				<Icon color={iconColor} size={18} />
				<Text className="font-semibold text-foreground text-sm">
					{job.status === "completed"
						? "Import complete"
						: job.status === "failed"
							? "Import failed"
							: "Importing from Trakt"}
				</Text>
			</View>

			{progress !== null ? (
				<View className="flex-row items-center gap-2">
					<View className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-subtle">
						<View
							className="h-full rounded-full bg-primary"
							style={{ width: `${progress}%` }}
						/>
					</View>
					<Text className="text-muted-foreground text-xs">{progress}%</Text>
				</View>
			) : null}

			{message ? (
				<Text className="text-muted-foreground text-sm leading-5">
					{message}
				</Text>
			) : null}
		</View>
	);
}
