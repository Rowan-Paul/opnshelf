import type { ListWithItemsDto } from "@opnshelf/api";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { formatRelativeTime } from "@/lib/relative-time";

/**
 * One info card summarising a list: description, who made it, when it last
 * changed, and completion. Shared by the owner route (`/lists/[slug]`) and the
 * public route (`/list/[handle]/[slug]`) so both render the same card, matching
 * the Web profile Lists page (ADR 0006 parity).
 *
 * Progress is viewer-relative, so callers pass `showProgress` false when signed
 * out or the list is empty and the card falls back to the item count. `creator`
 * is omitted on your own list — "Created by you" is noise.
 */
type ListInfoCardProps = Pick<
	ListWithItemsDto,
	"description" | "total" | "updatedAt" | "watchedCount"
> & {
	creator?: string;
	showProgress: boolean;
};

export function ListInfoCard({
	description,
	total,
	updatedAt,
	watchedCount,
	creator,
	showProgress,
}: ListInfoCardProps) {
	const progressPct = total > 0 ? Math.round((watchedCount / total) * 100) : 0;

	return (
		<View className="gap-2.5 rounded-xl border border-border bg-card p-4">
			{description ? (
				<Text className="text-muted-foreground text-sm leading-5">
					{description}
				</Text>
			) : null}

			<View className="flex-row flex-wrap gap-x-3 gap-y-1">
				{creator ? (
					<Text className="text-muted-foreground text-xs">
						Created by @{creator}
					</Text>
				) : null}
				<Text className="text-muted-foreground text-xs">
					Updated {formatRelativeTime(updatedAt)}
				</Text>
			</View>

			{showProgress ? (
				<View className="gap-1">
					<View className="flex-row items-center justify-between">
						<Text className="text-muted-foreground text-xs">
							{watchedCount} of {total} watched
						</Text>
						<Text className="text-muted-foreground text-xs">
							{progressPct}%
						</Text>
					</View>
					<View
						className="h-1 overflow-hidden rounded-full bg-background-subtle"
						accessibilityRole="progressbar"
						accessibilityLabel="List progress"
						accessibilityValue={{ min: 0, max: total, now: watchedCount }}
					>
						<View
							className="h-full rounded-full bg-primary"
							style={{ width: `${progressPct}%` }}
						/>
					</View>
				</View>
			) : (
				<Text className="text-muted-foreground text-xs">
					{total} item{total === 1 ? "" : "s"}
				</Text>
			)}
		</View>
	);
}
