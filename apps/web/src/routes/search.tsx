import {
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
	Film,
	Loader2,
	Search,
	Tv,
	UserMinus,
	UserPlus,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { UserAvatar } from "#/components/following/UserAvatar";
import MediaCard from "#/components/MediaCard";
import { Pagination } from "#/components/Pagination";
import { useDebounce } from "#/hooks/useDebounce";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";

setupApiClient();

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
					title: q ? `${q} — Search | OpnShelf` : "Search | OpnShelf",
				},
				{
					name: "description",
					content: "Search for movies, TV shows, and people on OpnShelf.",
				},
			],
		};
	},
});

type Tab = "all" | "movies" | "shows" | "people";

function getTitle(item: UnifiedSearchResultDto): string {
	return item.title || item.name || "Unknown";
}

function getYear(item: UnifiedSearchResultDto): number | undefined {
	const date = item.release_date || item.first_air_date;
	if (date) {
		return new Date(date).getFullYear();
	}
	return undefined;
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

const tabs: { key: Tab; label: string; icon: typeof Film }[] = [
	{ key: "all", label: "All", icon: Search },
	{ key: "movies", label: "Movies", icon: Film },
	{ key: "shows", label: "TV Shows", icon: Tv },
	{ key: "people", label: "People", icon: Users },
];

function SearchPage() {
	const search = useSearch({ from: Route.id });
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();
	const queryClient = useQueryClient();

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

	const { data: peopleData, isLoading: isSearchingPeople } = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		enabled: debouncedQuery.length > 0 && isAuthenticated,
	});

	const followMutation = useMutation({
		mutationKey: ["social", "follow"],
		...socialControllerFollowMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => {
					const key = q.queryKey[0] as { _id?: string } | undefined;
					return key?._id === "socialControllerSearchPeople";
				},
			});
		},
	});

	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow"],
		...socialControllerUnfollowMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => {
					const key = q.queryKey[0] as { _id?: string } | undefined;
					return key?._id === "socialControllerSearchPeople";
				},
			});
		},
	});

	const movies = useMemo(
		() =>
			searchData?.results?.filter(
				(r: UnifiedSearchResultDto) => r.media_type === "movie",
			) || [],
		[searchData],
	);
	const shows = useMemo(
		() =>
			searchData?.results?.filter(
				(r: UnifiedSearchResultDto) => r.media_type === "tv",
			) || [],
		[searchData],
	);
	const people = peopleData?.items || [];

	const hasQuery = debouncedQuery.length > 0;
	const isLoading = isSearching || (isAuthenticated && isSearchingPeople);
	const hasResults = movies.length > 0 || shows.length > 0 || people.length > 0;

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
					<Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-(--foreground-muted)" />
					<input
						type="text"
						placeholder="Search movies, shows, people..."
						className="input h-12 pl-12! text-lg"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					{isLoading && (
						<Loader2 className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 animate-spin text-(--foreground-muted)" />
					)}
				</div>
			</div>

			<div className="mb-6 border-(--border) border-b">
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
					<div className="flex flex-col items-center justify-center py-20 text-(--foreground-muted)">
						<Loader2 className="mb-4 h-10 w-10 animate-spin" />
						<p>Searching...</p>
					</div>
				) : !hasResults ? (
					<div className="flex flex-col items-center justify-center py-20 text-(--foreground-muted)">
						<Search className="mb-4 h-12 w-12 opacity-40" />
						<p className="text-lg">
							No results found for &quot;{debouncedQuery}&quot;
						</p>
						<p className="mt-1 text-sm">Try a different search term</p>
					</div>
				) : (
					<div className="space-y-6">
						{/* Combined Movies + TV Shows in "all" tab */}
						{activeTab === "all" &&
							searchData?.results &&
							searchData.results.length > 0 && (
								<section>
									<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
										{searchData.results.map((item) => (
											<MediaCard
												key={`media-${item.id}-${item.media_type}`}
												id={item.id}
												title={getTitle(item)}
												posterUrl={getPosterUrl(item)}
												backdropUrl={getBackdropUrl(item)}
												type={item.media_type === "movie" ? "movie" : "show"}
												year={getYear(item)}
												rating={item.vote_average || undefined}
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
								<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
									{movies.map((item) => (
										<MediaCard
											key={`movie-${item.id}`}
											id={item.id}
											title={getTitle(item)}
											posterUrl={getPosterUrl(item)}
											backdropUrl={getBackdropUrl(item)}
											type="movie"
											year={getYear(item)}
											rating={item.vote_average || undefined}
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
								<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
									{shows.map((item) => (
										<MediaCard
											key={`show-${item.id}`}
											id={item.id}
											title={getTitle(item)}
											posterUrl={getPosterUrl(item)}
											backdropUrl={getBackdropUrl(item)}
											type="show"
											year={getYear(item)}
											rating={item.vote_average || undefined}
											size="md"
											layout="poster"
										/>
									))}
								</div>
							</section>
						)}

						{(activeTab === "all" || activeTab === "people") && (
							<section>
								{activeTab === "all" && people.length > 0 && (
									<div className="mb-4 flex items-center justify-between">
										<h2 className="text-display-3">People</h2>
										<button
											type="button"
											onClick={() => handleTabChange("people")}
											className="font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
										>
											View all
										</button>
									</div>
								)}

								{!isAuthenticated && activeTab === "people" ? (
									<div className="card p-8 text-center">
										<Users className="mx-auto mb-3 h-10 w-10 text-(--foreground-muted)" />
										<p className="mb-2 text-(--foreground-muted)">
											Sign in to search people
										</p>
										<Link
											to="/login"
											className="btn btn-primary inline-flex gap-2"
										>
											Sign In
										</Link>
									</div>
								) : people.length > 0 ? (
									<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
													<p className="text-(--foreground-muted) text-xs">
														@{person.handle}
													</p>
												</div>
												{isAuthenticated &&
													person.isFollowing !== undefined && (
														<button
															type="button"
															className={`btn btn-sm h-8 px-3 text-xs ${
																person.isFollowing
																	? "btn-secondary"
																	: "btn-primary"
															}`}
															onClick={() => {
																if (person.isFollowing) {
																	unfollowMutation.mutate({
																		path: {
																			targetDid: person.did,
																		},
																	});
																} else {
																	followMutation.mutate({
																		path: {
																			targetDid: person.did,
																		},
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
																<Loader2 className="h-3 w-3 animate-spin" />
															) : unfollowMutation.variables?.path
																	?.targetDid === person.did ? (
																<Loader2 className="h-3 w-3 animate-spin" />
															) : person.isFollowing ? (
																<>
																	<UserMinus className="mr-1 h-3 w-3" />
																	Unfollow
																</>
															) : (
																<>
																	<UserPlus className="mr-1 h-3 w-3" />
																	Follow
																</>
															)}
														</button>
													)}
											</div>
										))}
									</div>
								) : activeTab === "people" && hasQuery ? (
									<div className="py-8 text-center text-(--foreground-muted)">
										No people found for &quot;{debouncedQuery}&quot;
									</div>
								) : null}
							</section>
						)}

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
					</div>
				)
			) : (
				<div className="flex flex-col items-center justify-center py-20 text-(--foreground-muted)">
					<Search className="mb-4 h-12 w-12 opacity-40" />
					<p className="text-lg">What are you looking for?</p>
					<p className="mt-1 text-sm">Search for movies, TV shows, or people</p>
				</div>
			)}
		</div>
	);
}
