import { socialControllerGetFeedOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Users } from "lucide-react-native";
import { View } from "react-native";
import { SectionHeader } from "@/components/home/SectionHeader";
import { ActivityRow } from "@/components/social/ActivityRow";
import { EmptyState } from "@/components/ui/states";

const MAX_AGE_DAYS = 30;
const PREVIEW_COUNT = 5;
const SKELETON_ROWS = 3;

/**
 * Loading placeholder mirroring the loaded card: a single bordered container
 * with divider-separated rows (like `ActivityRow`'s avatar + text-line
 * layout), rather than the shared `UserRowsSkeleton` (separately bordered
 * cards) which doesn't match this widget's single-card shape.
 */
function FriendsActivitySkeleton() {
	return (
		<View className="overflow-hidden rounded-xl border border-border bg-card">
			{Array.from({ length: SKELETON_ROWS }, (_, i) => i).map((i) => (
				<View
					key={i}
					className={`flex-row items-start gap-3 p-4 ${i === SKELETON_ROWS - 1 ? "" : "border-border border-b"}`}
				>
					<View className="h-10 w-10 rounded-full bg-background-subtle" />
					<View className="flex-1 gap-2">
						<View className="h-3 w-3/4 rounded bg-background-subtle" />
						<View className="h-2.5 w-1/3 rounded bg-background-subtle" />
					</View>
				</View>
			))}
		</View>
	);
}

/**
 * Friends Activity feed for the home dashboard (issue #144). Mirrors the web
 * dashboard `FriendsActivitySection`: friends' recent watches and reviews,
 * filtered to the last 30 days, each tappable to the media detail and to the
 * actor's profile. Reads from the same shared `socialControllerGetFeed`
 * procedure the web dashboard uses so the two surfaces stay in sync.
 *
 * Rendered inside the dashboard ScrollView, so it shows a fixed preview slice
 * rather than owning its own scrolling list; "View all" links to the dedicated
 * Activity tab.
 */
export function FriendsActivity() {
	const { data, isLoading } = useQuery({
		...socialControllerGetFeedOptions({ query: { pageSize: PREVIEW_COUNT } }),
	});

	const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
	const recentItems = (data?.items ?? [])
		.filter((item) => new Date(item.activityAt).getTime() >= cutoff)
		.slice(0, PREVIEW_COUNT);

	return (
		<View>
			<SectionHeader icon={Users} title="Activity" href="/activity" />
			{isLoading ? (
				<FriendsActivitySkeleton />
			) : recentItems.length === 0 ? (
				<EmptyState
					icon={MessageCircle}
					title="No recent activity"
					message="Activity from people you follow will appear here."
				/>
			) : (
				<View className="overflow-hidden rounded-xl border border-border bg-card">
					{recentItems.map((item, index) => (
						<ActivityRow
							key={item.id}
							activity={item}
							containerClassName={`flex-row items-start gap-3 p-4 ${index === recentItems.length - 1 ? "" : "border-border border-b"}`}
						/>
					))}
				</View>
			)}
		</View>
	);
}
