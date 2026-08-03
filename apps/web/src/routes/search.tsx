import {
	discoverControllerBecauseYouWatchedOptions,
	discoverControllerFromFollowsOptions,
	discoverControllerTrendingOptions,
	type PersonSearchResultDto,
	peopleControllerSearchPeopleOptions,
	type SocialUserCardDto,
	searchControllerSearchAllOptions,
	socialControllerFollowMutation,
	socialControllerSearchPeopleOptions,
	socialControllerUnfollowMutation,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import {
	Clapperboard,
	Film,
	Loader2,
	Search,
	Tv,
	UserMinus,
	UserPlus,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import ActionableMediaCard from "#/components/ActionableMediaCard";
import { UserAvatar } from "#/components/following/UserAvatar";
import { Pagination } from "#/components/Pagination";
import { PosterGridSkeleton, UserRowsSkeleton } from "#/components/skeletons";
import { useDebounce } from "#/hooks/useDebounce";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";
import { useBatchRatingsQuery } from "#/lib/hooks/useRatings";
import { buildPersonUrl } from "#/lib/url-utils";

const searchSchema = z.object({
	q: z.string().optional(),
	type: z.string().optional(),
	page: z.coerce.number().min(1).optional().default(1),
});

export const Route = createFileRoute("/search")({
	component: SearchPage,
	validateSearch: searchSchema,
	head: ({ match }) => {
		const q = match.search.q;
		return {
			meta: [
				{
					title: q ? `${q} — Search | Opnshelf` : "Search | Opnshelf",
				},
				{
					name: "description",
					content: "Search for movies, TV shows, and people on Opnshelf.",
				},
			],
		};
	},
});

type Tab = "all" | "movies" | "shows" | "people" | "cast";

function getTitle(item: UnifiedSearchResultDto): string {
	return item.title || item.name || "Unknown";
}

function getPosterUrl(item: UnifiedSearchResultDto): string {
	return item.poster_path
		? `https://image.tmdb.org/t/p/w500${item.poster_path}`
		: "";
}

function getBackdropUrl(item: UnifiedSearchResultDto): string | undefined {
	return item.backdrop_path
		? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
		: undefined;
}

function DiscoverRow({
	title,
	items,
}: {
	title: React.ReactNode;
	items: UnifiedSearchResultDto[];
}) {
	// Cold-start: a section with no items renders nothing at all.
	if (items.length === 0) return null;
	// Dedupe so React keys stay unique across rows.
	const seen = new Set<string>();
	const unique = items.filter((r) => {
		const k = `${r.media_type}-${r.id}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
	return (
		<section>
			<h2 className="mb-3 font-semibold text-lg">{title}</h2>
			{/* Single horizontal row (carousel), matching the mobile discovery
			    rails — discovery sections scroll sideways instead of wrapping. */}
			<div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
				{unique.map((item) => (
					<div
						key={`discover-${item.media_type}-${item.id}`}
						className="w-32 shrink-0 sm:w-40"
					>
						<ActionableMediaCard
							id={item.id}
							title={getTitle(item)}
							posterUrl={getPosterUrl(item)}
							backdropUrl={getBackdropUrl(item)}
							type={item.media_type === "movie" ? "movie" : "show"}
							tmdbRating={item.vote_average || undefined}
							layout="poster"
							fill
						/>
					</div>
				))}
			</div>
		</section>
	);
}

const tabs: { key: Tab; label: string; icon: typeof Film }[] = [
	{ key: "all", label: "All", icon: Search },
	{ key: "movies", label: "Movies", icon: Film },
	{ key: "shows", label: "TV Shows", icon: Tv },
	{ key: "cast", label: "Cast & Crew", icon: Clapperboard },
	{ key: "people", label: "Users", icon: Users },
];

function SearchPage() {
	const search = useSearch({ from: Route.id });
	const navigate = useNavigate();
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const queryClient = useQueryClient();

	// Redirect authenticated users who still need onboarding
	useEffect(() => {
		if (!authLoading && isAuthenticated && user?.needsOnboarding) {
			navigate({ to: "/onboarding" });
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	const initialQuery = search.q || "";
	const initialType = search.type || "";
	const initialPage = search.page;

	const validType = tabs.find((t) => t.key === initialType)?.key || "all";

	const [query, setQuery] = useState(initialQuery);
	const debouncedQuery = useDebounce(query, 400);
	const [activeTab, setActiveTab] = useState<Tab>(validType as Tab);
	const [page, setPage] = useState(initialPage);

	// Sync URL query to local state on back/forward
	useEffect(() => {
		setQuery(initialQuery);
	}, [initialQuery]);

	useEffect(() => {
		const urlType = tabs.find((t) => t.key === initialType)?.key || "all";
		setActiveTab(urlType as Tab);
	}, [initialType]);

	useEffect(() => {
		setPage(search.page);
	}, [search.page]);

	// Update URL when debounced query, tab, or page changes
	useEffect(() => {
		const newSearch: { q?: string; type?: string; page?: number } = {};
		if (debouncedQuery) newSearch.q = debouncedQuery;
		if (activeTab !== "all") newSearch.type = activeTab;
		if (page > 1) newSearch.page = page;

		const needsUpdate =
			debouncedQuery !== (search.q || "") ||
			(activeTab !== "all" ? activeTab : undefined) !==
				(search.type || undefined) ||
			(page > 1 ? page : undefined) !==
				(search.page > 1 ? search.page : undefined);

		if (needsUpdate) {
			navigate({
				to: "/search",
				search: Object.keys(newSearch).length > 0 ? newSearch : undefined,
				replace: true,
			});
		}
	}, [debouncedQuery, activeTab, page, navigate, search]);

	const { data: searchData, isLoading: isSearching } = useQuery({
		...searchControllerSearchAllOptions({
			query: { query: debouncedQuery, page },
		}),
		enabled: debouncedQuery.length > 0,
	});

	useEffect(() => {
		if (!debouncedQuery || !searchData) return;
		posthog.capture("search_performed", {
			surface: "search",
			tab: activeTab,
			query_length: debouncedQuery.length,
			result_count: searchData.results?.length ?? 0,
		});
	}, [activeTab, debouncedQuery, searchData]);

	const { data: peopleData, isLoading: isSearchingPeople } = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		enabled: debouncedQuery.length > 0 && isAuthenticated,
	});

	// Cast & Crew (TMDB people) — public, only fetched on its own tab.
	const { data: castData, isLoading: isSearchingCast } = useQuery({
		...peopleControllerSearchPeopleOptions({
			query: { query: debouncedQuery, page },
		}),
		enabled: debouncedQuery.length > 0 && activeTab === "cast",
	});

	const followMutation = useMutation({
		mutationKey: ["social", "follow"],
		...socialControllerFollowMutation(),
		onSuccess: () => {
			posthog.capture("user_followed", { source: "search" });
			toast.success("Followed");
			queryClient.invalidateQueries({
				predicate: (q) => {
					const key = q.queryKey[0] as { _id?: string } | undefined;
					return key?._id === "socialControllerSearchPeople";
				},
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to follow");
		},
	});

	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow"],
		...socialControllerUnfollowMutation(),
		onSuccess: () => {
			posthog.capture("user_unfollowed", { source: "search" });
			toast.success("Unfollowed");
			queryClient.invalidateQueries({
				predicate: (q) => {
					const key = q.queryKey[0] as { _id?: string } | undefined;
					return key?._id === "socialControllerSearchPeople";
				},
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to unfollow",
			);
		},
	});

	// Discovery sections — only fetched on the empty-query (browse) state.
	const browsing = debouncedQuery.length === 0;
	const { data: trendingData } = useQuery({
		...discoverControllerTrendingOptions(),
		enabled: browsing,
	});
	const { data: fromFollowsData } = useQuery({
		...discoverControllerFromFollowsOptions(),
		enabled: browsing && isAuthenticated,
	});
	const { data: becauseYouWatchedData } = useQuery({
		...discoverControllerBecauseYouWatchedOptions(),
		enabled: browsing && isAuthenticated,
	});

	// TMDB multi-search can return the same id twice → dedupe before rendering
	// so React keys stay unique (was "two children with the same key").
	const results = useMemo(() => {
		const seen = new Set<string>();
		return (searchData?.results || []).filter((r: UnifiedSearchResultDto) => {
			const k = `${r.media_type}-${r.id}`;
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}, [searchData]);
	const movies = useMemo(
		() => results.filter((r) => r.media_type === "movie"),
		[results],
	);
	const shows = useMemo(
		() => results.filter((r) => r.media_type === "tv"),
		[results],
	);
	const people = peopleData?.items || [];
	const cast = castData?.results || [];

	const mediaItems = useMemo(
		() =>
			results
				.filter(
					(r: UnifiedSearchResultDto) =>
						r.media_type === "movie" || r.media_type === "tv",
				)
				.map((r: UnifiedSearchResultDto) => ({
					id: r.id,
					type: (r.media_type === "movie" ? "movie" : "show") as
						| "movie"
						| "show",
				})),
		[results],
	);
	const { ratings } = useBatchRatingsQuery(mediaItems);

	const hasQuery = debouncedQuery.length > 0;
	const isLoading =
		isSearching ||
		(isAuthenticated && isSearchingPeople && activeTab === "people") ||
		(isSearchingCast && activeTab === "cast");
	const hasResults =
		activeTab === "people"
			? people.length > 0
			: activeTab === "cast"
				? cast.length > 0
				: activeTab === "movies"
					? movies.length > 0
					: activeTab === "shows"
						? shows.length > 0
						: movies.length > 0 || shows.length > 0;

	const handlePageChange = (newPage: number) => {
		setPage(newPage);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handleTabChange = (tab: Tab) => {
		setActiveTab(tab);
		setPage(1);
	};

	return (
		<div className="container-app py-8">
			<div className="mx-auto mb-8 max-w-2xl">
				<h1 className="mb-4 text-center text-display-2">Search</h1>
				<div className="relative">
					<Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-(--foreground-muted)" />
					<input
						type="text"
						placeholder="Search movies, shows, users..."
						className="input h-12 pl-12! text-lg"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					{isLoading && (
						<Loader2 className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-(--foreground-muted)" />
					)}
				</div>
			</div>

			{/* ponytail: tabs only filter search results, so they stay hidden on
			    the discover state instead of filtering the rows too. */}
			<div
				className={`mb-6 border-(--border) border-b ${query ? "" : "hidden"}`}
			>
				<nav className="flex gap-1 overflow-x-auto">
					{tabs.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.key;
						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => handleTabChange(tab.key)}
								className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-medium text-sm transition-colors ${
									isActive
										? "border-(--accent) text-(--accent)"
										: "border-transparent text-(--foreground-muted) hover:border-(--border-strong) hover:text-(--foreground)"
								}`}
							>
								<Icon className="h-4 w-4" />
								{tab.label}
							</button>
						);
					})}
				</nav>
			</div>

			{hasQuery ? (
				isLoading ? (
					activeTab === "people" || activeTab === "cast" ? (
						<UserRowsSkeleton rows={6} />
					) : (
						<PosterGridSkeleton
							count={12}
							gridClassName="grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
						/>
					)
				) : !hasResults ? (
					<div className="flex flex-col items-center justify-center py-20 text-(--foreground-muted)">
						<Search className="mb-4 size-12 opacity-40" />
						<p className="text-lg">
							No results found for &quot;{debouncedQuery}&quot;
						</p>
						<p className="mt-1 text-sm">Try a different search term</p>
					</div>
				) : (
					<div className="space-y-6">
						{/* Combined Movies + TV Shows in "all" tab */}
						{activeTab === "all" && results.length > 0 && (
							<section>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
									{results.map((item) => (
										<ActionableMediaCard
											key={`media-${item.id}-${item.media_type}`}
											id={item.id}
											title={getTitle(item)}
											posterUrl={getPosterUrl(item)}
											backdropUrl={getBackdropUrl(item)}
											type={item.media_type === "movie" ? "movie" : "show"}
											tmdbRating={item.vote_average || undefined}
											globalRating={ratings.get(String(item.id))?.averageRating}
											size="md"
											layout="poster"
										/>
									))}
								</div>
							</section>
						)}

						{/* Movies tab only */}
						{activeTab === "movies" && movies.length > 0 && (
							<section>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
									{movies.map((item) => (
										<ActionableMediaCard
											key={`movie-${item.id}`}
											id={item.id}
											title={getTitle(item)}
											posterUrl={getPosterUrl(item)}
											backdropUrl={getBackdropUrl(item)}
											type="movie"
											tmdbRating={item.vote_average || undefined}
											globalRating={ratings.get(String(item.id))?.averageRating}
											size="md"
											layout="poster"
										/>
									))}
								</div>
							</section>
						)}

						{/* TV Shows tab only */}
						{activeTab === "shows" && shows.length > 0 && (
							<section>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
									{shows.map((item) => (
										<ActionableMediaCard
											key={`show-${item.id}`}
											id={item.id}
											title={getTitle(item)}
											posterUrl={getPosterUrl(item)}
											backdropUrl={getBackdropUrl(item)}
											type="show"
											tmdbRating={item.vote_average || undefined}
											globalRating={ratings.get(String(item.id))?.averageRating}
											size="md"
											layout="poster"
										/>
									))}
								</div>
							</section>
						)}

						{activeTab === "people" && (
							<section>
								{!isAuthenticated ? (
									<div className="card p-8 text-center">
										<Users className="mx-auto mb-3 size-10 text-(--foreground-muted)" />
										<p className="mb-2 text-(--foreground-muted)">
											Sign in to search users
										</p>
										<Link
											to="/login"
											className="btn btn-primary inline-flex gap-2"
										>
											Sign In
										</Link>
									</div>
								) : people.length > 0 ? (
									<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
										{people.map((person: SocialUserCardDto) => (
											<div
												key={person.did}
												className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--background-elevated) p-4 transition-colors hover:border-(--border-strong)"
											>
												<UserAvatar
													src={person.avatar}
													alt={String(person.displayName) || person.handle}
													size="md"
												/>
												<div className="min-w-0 flex-1">
													<Link
														to="/profile/$handle"
														params={{
															handle: person.handle || person.did,
														}}
														className="block truncate font-medium text-sm hover:text-(--accent)"
													>
														{String(person.displayName) || person.handle}
													</Link>
													<p className="truncate text-(--foreground-muted) text-xs">
														@{person.handle}
													</p>
												</div>
												{person.isFollowing !== undefined && (
													<button
														type="button"
														className={`btn btn-sm h-8 shrink-0 px-3 text-xs ${
															person.isFollowing
																? "btn-secondary"
																: "btn-primary"
														}`}
														onClick={() => {
															if (person.isFollowing) {
																unfollowMutation.mutate({
																	path: { targetDid: person.did },
																});
															} else {
																followMutation.mutate({
																	path: { targetDid: person.did },
																});
															}
														}}
														disabled={
															followMutation.variables?.path?.targetDid ===
																person.did ||
															unfollowMutation.variables?.path?.targetDid ===
																person.did
														}
													>
														{followMutation.variables?.path?.targetDid ===
														person.did ? (
															<Loader2 className="size-3 animate-spin" />
														) : unfollowMutation.variables?.path?.targetDid ===
															person.did ? (
															<Loader2 className="size-3 animate-spin" />
														) : person.isFollowing ? (
															<>
																<UserMinus className="mr-1 size-3" />
																Unfollow
															</>
														) : (
															<>
																<UserPlus className="mr-1 size-3" />
																Follow
															</>
														)}
													</button>
												)}
											</div>
										))}
									</div>
								) : hasQuery ? (
									<div className="py-8 text-center text-(--foreground-muted)">
										No users found for &quot;{debouncedQuery}&quot;
									</div>
								) : null}
							</section>
						)}

						{activeTab === "cast" &&
							(cast.length > 0 ? (
								<section>
									<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
										{cast.map((person: PersonSearchResultDto) => (
											<Link
												key={person.id}
												to={buildPersonUrl(person.id, person.name)}
												className="card card-interactive flex items-center gap-3 p-3"
											>
												{person.profile_path ? (
													<img
														src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
														alt={person.name}
														className="h-12 w-12 rounded-full object-cover"
														loading="lazy"
													/>
												) : (
													<div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--background-subtle)">
														<Clapperboard className="size-5 text-(--foreground-muted)" />
													</div>
												)}
												<div className="min-w-0">
													<p className="truncate font-medium text-sm">
														{person.name}
													</p>
													{person.known_for_department && (
														<p className="truncate text-(--foreground-muted) text-xs">
															{person.known_for_department}
														</p>
													)}
												</div>
											</Link>
										))}
									</div>
								</section>
							) : hasQuery ? (
								<div className="py-8 text-center text-(--foreground-muted)">
									No cast or crew found for &quot;{debouncedQuery}&quot;
								</div>
							) : null)}

						{(activeTab === "all" ||
							activeTab === "movies" ||
							activeTab === "shows") &&
							(movies.length > 0 || shows.length > 0) && (
								<div className="flex justify-center pt-4">
									<Pagination
										page={page}
										totalPages={Math.max(
											1,
											Math.ceil((searchData?.total_results || 0) / 20),
										)}
										onPageChange={handlePageChange}
									/>
								</div>
							)}

						{activeTab === "cast" && cast.length > 0 && (
							<div className="flex justify-center pt-4">
								<Pagination
									page={page}
									totalPages={Math.max(1, castData?.total_pages || 1)}
									onPageChange={handlePageChange}
								/>
							</div>
						)}
					</div>
				)
			) : (
				<div className="space-y-8">
					{isAuthenticated && (
						<DiscoverRow
							title="From your follows"
							items={fromFollowsData?.results ?? []}
						/>
					)}

					{isAuthenticated &&
						(becauseYouWatchedData?.rows ?? []).map((row) => (
							<DiscoverRow
								key={`byw-${row.seedMediaType}-${row.seedId}`}
								title={
									<>
										Because you watched <em>{row.seedTitle}</em>
									</>
								}
								items={row.results}
							/>
						))}

					<DiscoverRow
						title="Trending this week"
						items={trendingData?.results ?? []}
					/>
				</div>
			)}
		</div>
	);
}
