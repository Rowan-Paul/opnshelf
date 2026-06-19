import {
	socialControllerFollowMutation,
	socialControllerGetFeedOptions,
	socialControllerGetFollowingOptions,
	socialControllerSearchPeopleOptions,
	socialControllerUnfollowMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ActivityFeed } from "#/components/following/ActivityFeed";
import { FollowingHeader } from "#/components/following/FollowingHeader";
import { FollowingList } from "#/components/following/FollowingList";
import { NetworkStats } from "#/components/following/NetworkStats";
import { PeopleSearch } from "#/components/following/PeopleSearch";
import { useDebounce } from "#/hooks/useDebounce";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/following")({
	head: () => ({
		meta: [
			{ title: "Following | OpnShelf" },
			{
				name: "description",
				content:
					"See what your friends are watching, discover new movies and shows, and manage who you follow on OpnShelf.",
			},
		],
	}),
	component: FollowingPage,
});
function FollowingPage() {
	const {
		user,
		userSettings,
		isAuthenticated,
		isLoading: authLoading,
	} = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const userHandle = user?.handle;

	// Redirect to login if not authenticated
	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	// Search state
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const debouncedSearch = useDebounce(searchQuery, 300);

	// Fetch following list
	const {
		data: followingData,
		isLoading: followingLoading,
		error: followingError,
	} = useQuery({
		...socialControllerGetFollowingOptions({
			path: { handle: userHandle || "" },
			query: { pageSize: 50 },
		}),
		enabled: !!userHandle,
	});

	// Fetch activity feed
	const {
		data: feedData,
		isLoading: feedLoading,
		error: feedError,
	} = useQuery({
		...socialControllerGetFeedOptions({
			query: { pageSize: 20 },
		}),
		enabled: !!userHandle,
	});

	// Search people
	const { data: searchData, isLoading: searchLoading } = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedSearch, pageSize: 10 },
		}),
		enabled: debouncedSearch.length > 0 && isSearching,
	});

	// Follow mutation
	const followMutation = useMutation({
		mutationKey: ["social", "follow"],
		...socialControllerFollowMutation(),
		onSuccess: async () => {
			toast.success("Followed");
			await queryClient.refetchQueries({
				predicate: (query) => {
					const queryKey = query.queryKey[0] as { _id?: string } | undefined;
					const id = queryKey?._id;
					return (
						id === "socialControllerGetFollowing" ||
						id === "socialControllerSearchPeople" ||
						id === "socialControllerGetFeed"
					);
				},
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to follow");
		},
	});

	// Unfollow mutation
	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow"],
		...socialControllerUnfollowMutation(),
		onSuccess: async () => {
			toast.success("Unfollowed");
			await queryClient.refetchQueries({
				predicate: (query) => {
					const queryKey = query.queryKey[0] as { _id?: string } | undefined;
					const id = queryKey?._id;
					return (
						id === "socialControllerGetFollowing" ||
						id === "socialControllerSearchPeople" ||
						id === "socialControllerGetFeed"
					);
				},
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to unfollow",
			);
		},
	});

	const handleFollow = useCallback(
		(targetDid: string) => {
			followMutation.mutate({ path: { targetDid } });
		},
		[followMutation],
	);

	const handleUnfollow = useCallback(
		(targetDid: string) => {
			unfollowMutation.mutate({ path: { targetDid } });
		},
		[unfollowMutation],
	);

	const handleSearchFocus = () => setIsSearching(true);
	const handleSearchBlur = () => {
		setTimeout(() => setIsSearching(false), 200);
	};

	const following = followingData?.items || [];
	const activities = feedData?.items || [];
	const searchResults = searchData?.items || [];

	const isFeedLoading = followingLoading || feedLoading;
	const hasFeedError = followingError || feedError;

	return (
		<div className="container-app py-8">
			<FollowingHeader />

			<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
				{/* Sidebar - shown above feed on mobile, right side on desktop */}
				<div className="order-1 space-y-6 lg:order-2">
					<FollowingList
						following={following}
						isLoading={followingLoading}
						error={followingError}
						onUnfollow={handleUnfollow}
						pendingUnfollowDid={unfollowMutation.variables?.path?.targetDid}
					/>
					<NetworkStats following={following} />
				</div>

				{/* Main Feed - shown below sidebar on mobile, left side on desktop */}
				<div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
					<PeopleSearch
						query={searchQuery}
						onQueryChange={setSearchQuery}
						isSearching={isSearching}
						onFocus={handleSearchFocus}
						onBlur={handleSearchBlur}
						results={searchResults}
						isLoading={searchLoading}
						onFollow={handleFollow}
						onUnfollow={handleUnfollow}
						pendingFollowDid={followMutation.variables?.path?.targetDid}
						pendingUnfollowDid={unfollowMutation.variables?.path?.targetDid}
					/>

					<ActivityFeed
						activities={activities}
						isLoading={isFeedLoading}
						error={hasFeedError}
						followingCount={following.length}
						userTimezone={userSettings?.timezone}
						userTimeFormat={userSettings?.timeFormat}
					/>

					{/* Load More */}
					{false && (
						<div className="flex justify-center">
							<button
								type="button"
								className="btn btn-secondary"
								disabled={false}
							>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Loading...
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
