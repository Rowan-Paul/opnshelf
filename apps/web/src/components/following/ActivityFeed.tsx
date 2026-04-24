import type { FollowedActivityItemDto } from "@opnshelf/api";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, Loader2, UserPlus } from "lucide-react";
import { ActivityCard } from "./ActivityCard";

interface ActivityFeedProps {
	activities: FollowedActivityItemDto[];
	isLoading: boolean;
	error: Error | null;
	followingCount: number;
	userTimezone?: string;
	userTimeFormat?: "12h" | "24h";
}

export function ActivityFeed({
	activities,
	isLoading,
	error,
	followingCount,
	userTimezone,
	userTimeFormat,
}: ActivityFeedProps) {
	const queryClient = useQueryClient();

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-[var(--accent)] mb-4" />
				<p className="text-[var(--foreground-muted)]">Loading activity...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-[var(--foreground-muted)]">
				<Activity className="h-12 w-12 mb-4 opacity-50" />
				<p>Failed to load activity feed</p>
				<button
					type="button"
					className="btn btn-secondary mt-4"
					onClick={() =>
						queryClient.invalidateQueries({
							queryKey: ["socialControllerGetFeed"],
						})
					}
				>
					Retry
				</button>
			</div>
		);
	}

	if (activities.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-[var(--foreground-muted)]">
				<Activity className="h-12 w-12 mb-4 opacity-50" />
				<p className="text-lg font-medium mb-2">No activity yet</p>
				<p className="text-sm">
					Follow people to see what they&apos;re watching
				</p>
				{followingCount === 0 && (
					<Link to={"/following" as const} className="btn btn-primary mt-4">
						<UserPlus className="h-4 w-4 mr-2" />
						Find people to follow
					</Link>
				)}
			</div>
		);
	}

	const deduped = activities.filter(
		(activity, index, self) =>
			index === self.findIndex((a) => a.id === activity.id),
	);

	return (
		<div className="space-y-4">
			{deduped.map((activity: FollowedActivityItemDto) => (
				<ActivityCard
					key={activity.id}
					activity={activity}
					userTimezone={userTimezone}
					userTimeFormat={userTimeFormat}
				/>
			))}
		</div>
	);
}
