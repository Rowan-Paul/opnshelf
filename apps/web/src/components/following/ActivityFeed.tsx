import { type FollowedActivityItemDto, groupActivities } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Activity, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { ActivityCardsSkeleton } from "#/components/skeletons";
import { ActivityCard } from "./ActivityCard";

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
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(timer);
	}, []);

	if (isLoading && activities.length === 0) {
		return <ActivityCardsSkeleton rows={3} />;
	}

	if (error && activities.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-(--foreground-muted)">
				<Activity className="mb-4 size-12 opacity-50" />
				<p>Couldn&apos;t load activity.</p>
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
					<p className="mb-2 font-medium text-lg">
						No activity from this Circle
					</p>
					<p className="text-sm">
						Try another Circle or add people to this one.
					</p>
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						<Link
							to="/social/circles/$circleId"
							params={{ circleId: activeCircleId }}
							search={{ circleId: activeCircleId }}
							className="btn btn-secondary"
						>
							Manage Circle
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
					Follow people to see what they&apos;re watching.
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
			{groupActivities(activities, userTimezone ?? "UTC", now).map(
				(group, index, groups) => (
					<div key={group.id}>
						{(index === 0 || groups[index - 1].day !== group.day) && (
							<h2 className="mb-3 font-semibold text-(--foreground-muted) text-sm">
								{group.label}
							</h2>
						)}
						<ActivityCard
							activity={group.items[0]}
							episodes={group.items}
							userTimezone={userTimezone}
							userTimeFormat={userTimeFormat}
						/>
					</div>
				),
			)}
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
