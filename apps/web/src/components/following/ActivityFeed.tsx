import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Activity, UserPlus } from "lucide-react";
import { CardRowsSkeleton } from "#/components/skeletons";
import { ActivityCard } from "./ActivityCard";

// Two columns on large screens so the feed fills the page like other lists
// (profile connections) instead of a narrow centred column.
const FEED_GRID = "grid grid-cols-1 gap-4 lg:grid-cols-2";

interface ActivityFeedProps {
	activities: FollowedActivityItemDto[];
	isLoading: boolean;
	error: Error | null;
	userTimezone?: string;
	userTimeFormat?: "12h" | "24h";
	activeCircleId?: string;
	onShowAllActivity?: () => void;
	hasNextPage?: boolean;
	isFetchingNextPage?: boolean;
	onLoadMore?: () => void;
	onRetry?: () => void;
}

export function ActivityFeed({
	activities,
	isLoading,
	error,
	userTimezone,
	userTimeFormat,
	activeCircleId,
	onShowAllActivity,
	hasNextPage,
	isFetchingNextPage,
	onLoadMore,
	onRetry,
}: ActivityFeedProps) {
	if (isLoading && activities.length === 0) {
		return <CardRowsSkeleton className={FEED_GRID} />;
	}

	if (error && activities.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-(--foreground-muted)">
				<Activity className="mb-4 size-12 opacity-50" />
				<p>Failed to load activity feed</p>
				<button
					type="button"
					className="btn btn-secondary mt-4"
					onClick={onRetry}
				>
					Retry
				</button>
			</div>
		);
	}

	if (activities.length === 0) {
		if (activeCircleId) {
			return (
				<div className="flex flex-col items-center justify-center py-12 text-center text-(--foreground-muted)">
					<Activity className="mb-4 size-12 opacity-50" />
					<p className="mb-2 font-medium text-lg">No activity in this circle</p>
					<p className="text-sm">
						Try another circle or add people to this one.
					</p>
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						<Link
							to="/social/circles/$circleId"
							params={{ circleId: activeCircleId }}
							search={{ circleId: activeCircleId }}
							className="btn btn-secondary"
						>
							Manage circle
						</Link>
						<button
							type="button"
							className="btn btn-primary"
							onClick={onShowAllActivity}
						>
							Show all activity
						</button>
					</div>
				</div>
			);
		}

		return (
			<div className="flex flex-col items-center justify-center py-12 text-(--foreground-muted)">
				<Activity className="mb-4 size-12 opacity-50" />
				<p className="mb-2 font-medium text-lg">No activity yet</p>
				<p className="text-sm">
					Follow people to see what they&apos;re watching
				</p>
				<Link to="/social/find" className="btn btn-primary mt-4">
					<UserPlus className="mr-2 size-4" />
					Find people to follow
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className={FEED_GRID}>
				{activities.map((activity: FollowedActivityItemDto) => (
					<ActivityCard
						key={activity.id}
						activity={activity}
						userTimezone={userTimezone}
						userTimeFormat={userTimeFormat}
					/>
				))}
			</div>
			{hasNextPage && (
				<div className="flex justify-center pt-2">
					<button
						type="button"
						className="btn btn-secondary"
						onClick={onLoadMore}
						disabled={isFetchingNextPage}
					>
						{isFetchingNextPage ? "Loading more…" : "Load more activity"}
					</button>
				</div>
			)}
		</div>
	);
}
