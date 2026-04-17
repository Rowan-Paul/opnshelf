import {
	type FollowedActivityItemDto,
	type SocialUserCardDto,
	socialControllerFollowMutation,
	socialControllerGetFeedOptions,
	socialControllerGetFollowingOptions,
	socialControllerSearchPeopleOptions,
	socialControllerUnfollowMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Activity,
	Clock,
	Film,
	Heart,
	Loader2,
	MessageCircle,
	MoreHorizontal,
	Search,
	Tv,
	UserCheck,
	UserPlus,
	Users,
	UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/following")({
	component: FollowingPage,
});

// Initialize API client
setupApiClient();

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debouncedValue;
}

// Format relative time
function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) return "Just now";
	if (diffInSeconds < 3600)
		return `${Math.floor(diffInSeconds / 60)} minutes ago`;
	if (diffInSeconds < 86400)
		return `${Math.floor(diffInSeconds / 3600)} hours ago`;
	if (diffInSeconds < 604800)
		return `${Math.floor(diffInSeconds / 86400)} days ago`;
	return date.toLocaleDateString();
}

function FollowingPage() {
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
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
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
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
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["socialControllerGetFollowing"],
			});
			queryClient.invalidateQueries({
				queryKey: ["socialControllerSearchPeople"],
			});
		},
	});

	// Unfollow mutation
	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow"],
		...socialControllerUnfollowMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["socialControllerGetFollowing"],
			});
			queryClient.invalidateQueries({
				queryKey: ["socialControllerSearchPeople"],
			});
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
		// Delay to allow clicking on results
		setTimeout(() => setIsSearching(false), 200);
	};

	const following = followingData?.items || [];
	const activities = feedData?.items || [];
	const searchResults = searchData?.items || [];

	const isLoading = followingLoading || feedLoading;
	const hasError = followingError || feedError;

	return (
		<div className="container-app py-8">
			{/* Header */}
			<div className="mb-8">
				<div className="flex items-center gap-3 mb-2">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
						<Users className="h-5 w-5" />
					</div>
					<h1 className="text-display-2">Following</h1>
				</div>
				<p className="text-[var(--foreground-muted)] ml-[52px]">
					See what your friends are watching and discover new content.
				</p>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Main Feed */}
				<div className="lg:col-span-2 space-y-6">
					{/* Search/Add Friend */}
					<div className="relative">
						<div className="flex gap-3">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
								<input
									type="text"
									placeholder="Find people to follow..."
									className="input pl-10"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onFocus={handleSearchFocus}
									onBlur={handleSearchBlur}
								/>
								{searchLoading && (
									<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--foreground-muted)]" />
								)}
							</div>
						</div>

						{/* Search Results Dropdown */}
						{isSearching && searchQuery.length > 0 && (
							<div className="absolute top-full left-0 right-0 mt-2 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
								{searchResults.length === 0 ? (
									<div className="p-4 text-center text-[var(--foreground-muted)]">
										{searchLoading ? "Searching..." : "No users found"}
									</div>
								) : (
									<div className="p-2 space-y-1">
										{searchResults.map((person: SocialUserCardDto) => (
											<div
												key={person.did}
												className="flex items-center gap-3 p-2 hover:bg-[var(--background-subtle)] rounded-lg"
											>
												<img
													src={
														person.avatar
															? String(person.avatar)
															: `https://i.pravatar.cc/150?u=${person.did}`
													}
													alt={String(person.displayName) || person.handle}
													className="h-10 w-10 rounded-full object-cover"
												/>
												<div className="flex-1 min-w-0">
													<p className="font-medium text-sm truncate">
														{String(person.displayName) || person.handle}
													</p>
													<p className="text-xs text-[var(--foreground-muted)]">
														@{person.handle}
													</p>
												</div>
												{person.isFollowing ? (
													<button
														type="button"
														className="btn btn-secondary btn-sm h-8 px-3 text-xs"
														onClick={() => handleUnfollow(person.did)}
														disabled={unfollowMutation.isPending}
													>
														{unfollowMutation.isPending ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															"Unfollow"
														)}
													</button>
												) : (
													<button
														type="button"
														className="btn btn-primary btn-sm h-8 px-3 text-xs"
														onClick={() => handleFollow(person.did)}
														disabled={followMutation.isPending}
													>
														{followMutation.isPending ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															<>
																<UserPlus className="h-3 w-3 mr-1" />
																Follow
															</>
														)}
													</button>
												)}
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>

					{/* Activity Feed */}
					<div className="space-y-4">
						{isLoading ? (
							<div className="flex flex-col items-center justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-[var(--accent)] mb-4" />
								<p className="text-[var(--foreground-muted)]">
									Loading activity...
								</p>
							</div>
						) : hasError ? (
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
						) : activities.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-[var(--foreground-muted)]">
								<Activity className="h-12 w-12 mb-4 opacity-50" />
								<p className="text-lg font-medium mb-2">No activity yet</p>
								<p className="text-sm">
									Follow people to see what they&apos;re watching
								</p>
								{following.length === 0 && (
									<Link to="/discover" className="btn btn-primary mt-4">
										<UserPlus className="h-4 w-4 mr-2" />
										Find people to follow
									</Link>
								)}
							</div>
						) : (
							activities.map((activity: FollowedActivityItemDto) => (
								<article
									key={activity.id}
									className="card p-5 transition-shadow hover:shadow-md"
								>
									{/* Activity Header */}
									<div className="flex items-start gap-3">
										<img
											src={
												activity.actor.avatar
													? String(activity.actor.avatar)
													: `https://i.pravatar.cc/150?u=${activity.actor.did}`
											}
											alt={
												String(activity.actor.displayName) ||
												activity.actor.handle
											}
											className="h-10 w-10 rounded-full object-cover"
										/>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<Link
													to={`/user/${activity.actor.handle}`}
													className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
												>
													{String(activity.actor.displayName) ||
														activity.actor.handle}
												</Link>
												<span className="text-[var(--foreground-muted)]">
													{activity.type === "movie"
														? "watched"
														: "watched episode"}
												</span>
												<Link
													to={
														activity.type === "movie"
															? `/movies/${activity.movieId}`
															: `/shows/${activity.showId}/seasons/${activity.seasonNumber}/episodes/${activity.episodeNumber}`
													}
													className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]"
												>
													{activity.title || activity.showTitle}
												</Link>
												<span className="badge badge-subtle">
													{activity.type === "movie" ? (
														<Film className="h-3 w-3" />
													) : (
														<Tv className="h-3 w-3" />
													)}
												</span>
												{activity.seasonNumber && activity.episodeNumber && (
													<span className="text-sm text-[var(--foreground-muted)]">
														S{activity.seasonNumber}E{activity.episodeNumber}
													</span>
												)}
											</div>
											<div className="flex items-center gap-2 mt-1 text-sm text-[var(--foreground-muted)]">
												<Clock className="h-3 w-3" />
												{formatRelativeTime(activity.activityAt)}
											</div>
										</div>
										<button
											type="button"
											className="btn btn-ghost h-8 w-8 p-0 text-[var(--foreground-muted)]"
											aria-label="More options"
										>
											<MoreHorizontal className="h-4 w-4" />
										</button>
									</div>

									{/* Media Preview */}
									{(activity.posterPath || activity.backdropPath) && (
										<div className="mt-4 flex gap-4">
											<Link
												to={
													activity.type === "movie"
														? `/movies/${activity.movieId}`
														: `/shows/${activity.showId}`
												}
											>
												<img
													src={
														activity.posterPath
															? `https://image.tmdb.org/t/p/w300${activity.posterPath}`
															: `https://image.tmdb.org/t/p/w300${activity.backdropPath}`
													}
													alt={activity.title || activity.showTitle || ""}
													className="h-24 w-16 rounded-lg object-cover"
												/>
											</Link>
											<div className="flex-1">
												<p className="text-[var(--foreground-muted)] text-sm line-clamp-3">
													{activity.overview}
												</p>
											</div>
										</div>
									)}

									{/* Actions */}
									<div className="mt-4 flex items-center gap-4 pt-4 border-t border-[var(--border)]">
										<button
											type="button"
											className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
										>
											<Heart className="h-4 w-4" />
											Like
										</button>
										<button
											type="button"
											className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
										>
											<MessageCircle className="h-4 w-4" />
											Comment
										</button>
									</div>
								</article>
							))
						)}
					</div>

					{/* Load More */}
					{hasNextPage && (
						<div className="flex justify-center">
							<button
								type="button"
								className="btn btn-secondary"
								onClick={() => fetchNextPage()}
								disabled={isFetchingNextPage}
							>
								{isFetchingNextPage ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Loading...
									</>
								) : (
									"Load more activity"
								)}
							</button>
						</div>
					)}
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Following List */}
					<section className="card p-5">
						<h3 className="font-display font-semibold mb-4">
							Following ({following.length})
						</h3>
						{followingLoading ? (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
							</div>
						) : followingError ? (
							<div className="text-center text-[var(--foreground-muted)] py-4">
								<p>Failed to load following list</p>
							</div>
						) : following.length === 0 ? (
							<div className="text-center text-[var(--foreground-muted)] py-4">
								<UserX className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">You&apos;re not following anyone yet</p>
							</div>
						) : (
							<div className="space-y-3">
								{following.slice(0, 5).map((friend: SocialUserCardDto) => (
									<div key={friend.did} className="flex items-center gap-3">
										<img
											src={
												friend.avatar
													? String(friend.avatar)
													: `https://i.pravatar.cc/150?u=${friend.did}`
											}
											alt={String(friend.displayName) || friend.handle}
											className="h-10 w-10 rounded-full object-cover"
										/>
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm truncate">
												{String(friend.displayName) || friend.handle}
											</p>
											<p className="text-xs text-[var(--foreground-muted)]">
												@{friend.handle}
											</p>
										</div>
										<button
											type="button"
											className="btn btn-secondary btn-sm h-8 px-2 text-xs"
											onClick={() => handleUnfollow(friend.did)}
											disabled={unfollowMutation.isPending}
											title="Unfollow"
										>
											{unfollowMutation.isPending ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												<UserCheck className="h-3 w-3" />
											)}
										</button>
									</div>
								))}
							</div>
						)}
						{following.length > 5 && (
							<button
								type="button"
								className="mt-4 w-full text-center text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
							>
								View all {following.length} following
							</button>
						)}
					</section>

					{/* Your Network Stats */}
					<section className="card p-5">
						<h3 className="font-display font-semibold mb-4">Your Network</h3>
						<div className="space-y-3 text-sm">
							<div className="flex justify-between">
								<span className="text-[var(--foreground-muted)]">
									Following
								</span>
								<span className="font-medium">{following.length} people</span>
							</div>
							<div className="flex justify-between">
								<span className="text-[var(--foreground-muted)]">
									Followers
								</span>
								<span className="font-medium">
									{following[0]?.followersCount || 0} people
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-[var(--foreground-muted)]">Mutual</span>
								<span className="font-medium">
									{
										following.filter((f: SocialUserCardDto) => f.isFollowedBy)
											.length
									}{" "}
									people
								</span>
							</div>
						</div>
					</section>

					{/* Discover People CTA */}
					<section className="card p-5 bg-gradient-to-br from-[var(--accent-subtle)] to-transparent">
						<h3 className="font-display font-semibold mb-2">Discover People</h3>
						<p className="text-sm text-[var(--foreground-muted)] mb-4">
							Find more people to follow and see what they&apos;re watching.
						</p>
						<Link to="/discover" className="btn btn-primary w-full">
							<UserPlus className="h-4 w-4 mr-2" />
							Find People
						</Link>
					</section>
				</div>
			</div>
		</div>
	);
}
