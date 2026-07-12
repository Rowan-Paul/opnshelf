import { socialControllerGetFeedOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ActivityFeed } from "#/components/following/ActivityFeed";
import { CircleFilterBar } from "#/components/following/CircleFilterBar";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";
import { useCircles } from "#/lib/hooks/useCircles";

export const Route = createFileRoute("/activity")({
	head: () => ({
		meta: [
			{ title: "Activity | OpnShelf" },
			{
				name: "description",
				content:
					"Recent watches and reviews from the people you follow on OpnShelf.",
			},
		],
	}),
	component: ActivityPage,
});

function ActivityPage() {
	const {
		user,
		userSettings,
		isAuthenticated,
		isLoading: authLoading,
	} = useAuth();
	const navigate = useNavigate();
	const userHandle = user?.handle;

	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	const [activeCircleId, setActiveCircleId] = useState<string | undefined>();
	const { data: circles = [] } = useCircles();

	// If the selected circle was deleted, fall back to the full feed.
	useEffect(() => {
		if (
			activeCircleId &&
			!circles.some((circle) => circle.id === activeCircleId)
		) {
			setActiveCircleId(undefined);
		}
	}, [activeCircleId, circles]);

	const {
		data: feedData,
		isLoading: feedLoading,
		error: feedError,
	} = useQuery({
		...socialControllerGetFeedOptions({
			query: { pageSize: 20, circleId: activeCircleId },
		}),
		enabled: !!userHandle,
	});

	const activities = feedData?.items || [];
	useEffect(() => {
		if (feedData) posthog.capture("activity_viewed", { surface: "activity" });
	}, [feedData]);

	return (
		<div className="container-app py-8">
			<div className="mb-6">
				<h1 className="font-bold font-display text-3xl">Activity</h1>
				<p className="text-(--foreground-muted)">
					Recent watches and reviews from people you follow
				</p>
			</div>

			<div className="mx-auto max-w-2xl space-y-6">
				{circles.length > 0 && (
					<CircleFilterBar
						circles={circles}
						activeCircleId={activeCircleId}
						onSelect={setActiveCircleId}
					/>
				)}

				<ActivityFeed
					activities={activities}
					isLoading={feedLoading}
					error={feedError}
					// ponytail: pass 1 so the empty state reads "no activity yet" rather
					// than "follow people"; the real following count lives on Profile now.
					followingCount={1}
					userTimezone={userSettings?.timezone}
					userTimeFormat={userSettings?.timeFormat}
				/>
			</div>
		</div>
	);
}
