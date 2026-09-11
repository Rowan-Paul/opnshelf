import {
	socialControllerGetFeedInfiniteOptions,
	socialControllerGetFollowingOptions,
	socialControllerGetSuggestionsOptions,
	socialControllerSearchPeopleOptions,
} from "@opnshelf/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Compass, Plus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ActivityFeed } from "#/components/following/ActivityFeed";
import { CircleFilterBar } from "#/components/following/CircleFilterBar";
import { PeopleSearch } from "#/components/following/PeopleSearch";
import { useSocialFollowActions } from "#/components/following/useSocialFollowActions";
import { useDebounce } from "#/hooks/useDebounce";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";
import { useCircles } from "#/lib/hooks/useCircles";

const socialSearchSchema = z.object({
	circleId: z.string().optional(),
});

export const Route = createFileRoute("/social/")({
	validateSearch: socialSearchSchema,
	head: () => ({
		meta: [
			{ title: "Social | Opnshelf" },
			{
				name: "description",
				content:
					"Recent watches and reviews from the people you follow on Opnshelf.",
			},
		],
	}),
	component: SocialPage,
});

function SocialPage() {
	const { circleId: activeCircleId } = Route.useSearch();
	const {
		user,
		userSettings,
		isAuthenticated,
		isLoading: authLoading,
	} = useAuth();
	const navigate = useNavigate();
	const circlesQuery = useCircles();
	const circles = circlesQuery.data ?? [];
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebounce(searchQuery, 300);
	const { follow, unfollow, pendingFollowDid, pendingUnfollowDid } =
		useSocialFollowActions("social");

	useEffect(() => {
		if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
	}, [authLoading, isAuthenticated, navigate]);

	useEffect(() => {
		if (
			circlesQuery.isSuccess &&
			activeCircleId &&
			!circles.some((circle) => circle.id === activeCircleId)
		) {
			navigate({ to: "/social", replace: true });
		}
	}, [activeCircleId, circles, circlesQuery.isSuccess, navigate]);

	const followingQuery = useQuery({
		...socialControllerGetFollowingOptions({
			path: { handle: user?.handle || "" },
			query: { pageSize: 1 },
		}),
		enabled: !!user?.handle,
	});
	const noFollows = followingQuery.data?.total === 0;

	const feed = useInfiniteQuery({
		...socialControllerGetFeedInfiniteOptions({
			query: { pageSize: 20, circleId: activeCircleId },
		}),
		enabled: !!user?.handle,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	const activities = feed.data?.pages.flatMap((page) => page.items) ?? [];

	// Once per visit: infinite-query page appends and refetches also change
	// `feed.data`, and none of those are a new view.
	const activityViewed = useRef(false);
	useEffect(() => {
		if (feed.data && !activityViewed.current) {
			activityViewed.current = true;
			posthog.capture("activity_viewed", { surface: "social" });
		}
	}, [feed.data]);

	return (
		<div className="container-app py-8">
			<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="font-bold font-display text-3xl" data-tour="social">
						Social
					</h1>
					<p className="text-(--foreground-muted)">
						Recent watches and reviews from people you follow
					</p>
				</div>
				<div className="flex gap-2">
					<Link
						to="/social/find"
						search={{ circleId: activeCircleId }}
						className="btn btn-secondary"
					>
						<Compass className="mr-2 size-4" /> Find people
					</Link>
					<Link
						to="/social/circles"
						search={{ circleId: activeCircleId }}
						className="btn btn-secondary"
					>
						<Users className="mr-2 size-4" /> Circles
					</Link>
				</div>
			</div>

			<div className="space-y-6">
				{circles.length > 0 && (
					<CircleFilterBar
						circles={circles}
						activeCircleId={activeCircleId}
						onSelect={(circleId) =>
							navigate({
								to: "/social",
								search: circleId ? { circleId } : {},
								replace: true,
							})
						}
					/>
				)}

				{noFollows ? (
					<NoFollowsPeopleSearch
						query={searchQuery}
						onQueryChange={setSearchQuery}
						debouncedQuery={debouncedSearch}
						onFollow={follow}
						onUnfollow={unfollow}
						pendingFollowDid={pendingFollowDid}
						pendingUnfollowDid={pendingUnfollowDid}
					/>
				) : (
					<ActivityFeed
						activities={activities}
						isLoading={feed.isLoading || followingQuery.isLoading}
						error={feed.error}
						activeCircleId={activeCircleId}
						onShowAllActivity={() =>
							navigate({ to: "/social", search: {}, replace: true })
						}
						hasNextPage={feed.hasNextPage}
						isFetchingNextPage={feed.isFetchingNextPage}
						onLoadMore={() => feed.fetchNextPage()}
						onRetry={() => feed.refetch()}
						userTimezone={userSettings?.timezone}
						userTimeFormat={userSettings?.timeFormat}
					/>
				)}
			</div>
		</div>
	);
}

function NoFollowsPeopleSearch({
	query,
	onQueryChange,
	debouncedQuery,
	onFollow,
	onUnfollow,
	pendingFollowDid,
	pendingUnfollowDid,
}: {
	query: string;
	onQueryChange: (value: string) => void;
	debouncedQuery: string;
	onFollow: (did: string) => void;
	onUnfollow: (did: string) => void;
	pendingFollowDid?: string;
	pendingUnfollowDid?: string;
}) {
	const search = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 10 },
		}),
		enabled: debouncedQuery.trim().length > 0,
	});
	const suggestions = useQuery({
		...socialControllerGetSuggestionsOptions(),
	});

	return (
		<section className="card space-y-4 p-5">
			<div>
				<h2 className="font-display font-semibold text-lg">Find your people</h2>
				<p className="text-(--foreground-muted) text-sm">
					Follow people to fill your activity feed.
				</p>
			</div>
			<PeopleSearch
				query={query}
				onQueryChange={onQueryChange}
				isSearching
				onFocus={() => {}}
				onBlur={() => {}}
				results={search.data?.items ?? []}
				isLoading={search.isLoading}
				error={search.error}
				onRetry={() => search.refetch()}
				suggestions={suggestions.data?.items ?? []}
				isSuggestionsLoading={suggestions.isLoading}
				suggestionsError={suggestions.error}
				onRetrySuggestions={() => suggestions.refetch()}
				inline
				onFollow={onFollow}
				onUnfollow={onUnfollow}
				pendingFollowDid={pendingFollowDid}
				pendingUnfollowDid={pendingUnfollowDid}
			/>
			<Link to="/social/find" className="btn btn-secondary inline-flex">
				<Plus className="mr-2 size-4" /> Browse more people
			</Link>
		</section>
	);
}
