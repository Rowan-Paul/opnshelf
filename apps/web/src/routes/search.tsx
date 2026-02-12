import {
	authControllerMeOptions,
	moviesControllerDiscoverMoviesOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerSearchMoviesOptions,
	moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

function createTitleSlug(title: string): string {
	return title
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

export const Route = createFileRoute("/search")({
	component: SearchPage,
	validateSearch: (search: Record<string, unknown>) => ({
		q: (search.q as string) || "",
	}),
	head: () => ({
		meta: [{ title: "Search Movies | OpnShelf" }],
	}),
});

const DEBOUNCE_MS = 300;

function SearchPage() {
	const { q: searchQuery } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const queryClient = useQueryClient();
	const [query, setQuery] = useState(searchQuery);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastNavigatedQueryRef = useRef<string>(searchQuery);

	// Fetch auth state using generated TanStack Query hook
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	// Fetch user's tracked movies when logged in using generated TanStack Query hook
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	// Build a set of watched movie IDs for fast lookup
	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m: { movieId: string }) => m.movieId));
	}, [trackedMovies]);

	// Mutation for marking as watched using generated TanStack Query hook
	const markMutation = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			toast.success("Added to your shelf");
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	// Mutation for unmarking as watched using generated TanStack Query hook
	const unmarkMutation = useMutation({
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	// Sync input with URL only for external navigation (back/forward buttons)
	// Skip sync if we just navigated internally to avoid overwriting user's input
	useEffect(() => {
		if (searchQuery !== lastNavigatedQueryRef.current) {
			setQuery(searchQuery);
			lastNavigatedQueryRef.current = searchQuery;
		}
	}, [searchQuery]);

	// Debounced navigation when query changes
	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		const trimmed = query.trim();
		if (trimmed !== searchQuery) {
			debounceRef.current = setTimeout(() => {
				lastNavigatedQueryRef.current = trimmed;
				navigate({ search: { q: trimmed } });
			}, DEBOUNCE_MS);
		}

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [query, searchQuery, navigate]);

	// Search movies using generated TanStack Query hook
	const { data, isLoading, error } = useQuery({
		...moviesControllerSearchMoviesOptions({
			query: { query: searchQuery },
		}),
		enabled: searchQuery.length > 0,
	});

	// Discover popular movies when no search query
	const { data: discoverData, isLoading: isDiscoverLoading } = useQuery({
		...moviesControllerDiscoverMoviesOptions({
			query: { sortBy: "popularity.desc", page: 1 },
		}),
		enabled: searchQuery.length === 0,
	});

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<h1 className="text-4xl font-bold mb-8">Search Movies</h1>

				<div className="mb-8">
					<div className="relative max-w-2xl">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
						<Input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search for a movie..."
							className="w-full pl-10 bg-gray-900 border-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-purple-500"
						/>
					</div>
				</div>

				{isLoading && (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
						{["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((key) => (
							<div key={`search-loading-${key}`}>
								<Skeleton className="aspect-2/3 rounded-lg mb-2" />
								<Skeleton className="h-4 w-3/4 mb-1" />
								<Skeleton className="h-3 w-1/2" />
							</div>
						))}
					</div>
				)}

				{error && (
					<Alert variant="destructive" className="max-w-2xl">
						<AlertDescription>Error: {error.message}</AlertDescription>
					</Alert>
				)}

				{data && data.results.length > 0 && (
					<div>
						<p className="text-gray-400 mb-6">
							Found {data.total_results.toLocaleString()} results
						</p>
						<TooltipProvider>
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
								{data.results.map((movie) => {
									const movieId = movie.id.toString();
									const isWatched = watchedMovieIds.has(movieId);

									return (
										<div key={movie.id} className="group">
											<Link
												to="/movies/$movieId/$title"
												params={{
													movieId: movieId,
													title: createTitleSlug(movie.title),
												}}
												className="block relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2"
											>
												{movie.poster_path ? (
													<img
														src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
														alt={movie.title}
														className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-gray-600">
														No poster
													</div>
												)}
												{user && (
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																type="button"
																size="icon"
																variant={isWatched ? "default" : "default"}
																onClick={(e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	if (isWatched) {
																		unmarkMutation.mutate({
																			path: { movieId },
																		});
																	} else {
																		markMutation.mutate({
																			body: { movieId },
																		});
																	}
																}}
																disabled={
																	(markMutation.isPending &&
																		markMutation.variables?.body?.movieId ===
																			movieId) ||
																	(unmarkMutation.isPending &&
																		unmarkMutation.variables?.path?.movieId ===
																			movieId)
																}
																className={`absolute top-2 right-2 z-10 ${
																	isWatched
																		? "bg-green-600 hover:bg-red-600"
																		: "bg-purple-600 hover:bg-purple-700 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
																} transition-opacity`}
															>
																{(markMutation.isPending &&
																	markMutation.variables?.body?.movieId ===
																		movieId) ||
																(unmarkMutation.isPending &&
																	unmarkMutation.variables?.path?.movieId ===
																		movieId) ? (
																	<Loader2 className="w-4 h-4 animate-spin" />
																) : isWatched ? (
																	<Check className="w-4 h-4" />
																) : (
																	<Plus className="w-4 h-4" />
																)}
															</Button>
														</TooltipTrigger>
														<TooltipContent>
															<p>
																{isWatched
																	? "Remove from shelf"
																	: "Mark as watched"}
															</p>
														</TooltipContent>
													</Tooltip>
												)}
											</Link>
											<Link
												to="/movies/$movieId/$title"
												params={{
													movieId: movieId,
													title: createTitleSlug(movie.title),
												}}
												className="block"
											>
												<h3 className="font-semibold text-sm line-clamp-2 mb-1 hover:text-purple-400 transition-colors">
													{movie.title}
												</h3>
												{movie.release_date && (
													<p className="text-gray-500 text-sm">
														{movie.release_date.split("-")[0]}
													</p>
												)}
											</Link>
										</div>
									);
								})}
							</div>
						</TooltipProvider>
					</div>
				)}

				{data && data.results.length === 0 && searchQuery && (
					<div className="text-center py-12">
						<p className="text-gray-400 text-lg">
							No results found for &quot;{searchQuery}&quot;
						</p>
					</div>
				)}

				{/* Popular movies suggestions when no search query */}
				{!searchQuery && (
					<div>
						<h2 className="text-xl font-semibold text-gray-200 mb-4">
							Popular Movies
						</h2>
						{isDiscoverLoading && (
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
								{["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(
									(key) => (
										<div key={`discover-loading-${key}`}>
											<Skeleton className="aspect-2/3 rounded-lg mb-2" />
											<Skeleton className="h-4 w-3/4 mb-1" />
											<Skeleton className="h-3 w-1/2" />
										</div>
									),
								)}
							</div>
						)}
						{discoverData && discoverData.results.length > 0 && (
							<TooltipProvider>
								<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
									{discoverData.results.map((movie) => {
										const movieId = movie.id.toString();
										const isWatched = watchedMovieIds.has(movieId);

										return (
											<div key={movie.id} className="group">
												<Link
													to="/movies/$movieId/$title"
													params={{
														movieId: movieId,
														title: createTitleSlug(movie.title),
													}}
													className="block relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2"
												>
													{movie.poster_path ? (
														<img
															src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
															alt={movie.title}
															className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
														/>
													) : (
														<div className="w-full h-full flex items-center justify-center text-gray-600">
															No poster
														</div>
													)}
													{user && (
														<Tooltip>
															<TooltipTrigger asChild>
																<Button
																	type="button"
																	size="icon"
																	variant={isWatched ? "default" : "default"}
																	onClick={(e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		if (isWatched) {
																			unmarkMutation.mutate({
																				path: { movieId },
																			});
																		} else {
																			markMutation.mutate({
																				body: { movieId },
																			});
																		}
																	}}
																	disabled={
																		(markMutation.isPending &&
																			markMutation.variables?.body?.movieId ===
																				movieId) ||
																		(unmarkMutation.isPending &&
																			unmarkMutation.variables?.path
																				?.movieId === movieId)
																	}
																	className={`absolute top-2 right-2 z-10 ${
																		isWatched
																			? "bg-green-600 hover:bg-red-600"
																			: "bg-purple-600 hover:bg-purple-700 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
																	} transition-opacity`}
																>
																	{(markMutation.isPending &&
																		markMutation.variables?.body?.movieId ===
																			movieId) ||
																	(unmarkMutation.isPending &&
																		unmarkMutation.variables?.path?.movieId ===
																			movieId) ? (
																		<Loader2 className="w-4 h-4 animate-spin" />
																	) : isWatched ? (
																		<Check className="w-4 h-4" />
																	) : (
																		<Plus className="w-4 h-4" />
																	)}
																</Button>
															</TooltipTrigger>
															<TooltipContent>
																<p>
																	{isWatched
																		? "Remove from shelf"
																		: "Mark as watched"}
																</p>
															</TooltipContent>
														</Tooltip>
													)}
												</Link>
												<Link
													to="/movies/$movieId/$title"
													params={{
														movieId: movieId,
														title: createTitleSlug(movie.title),
													}}
													className="block"
												>
													<h3 className="font-semibold text-sm line-clamp-2 mb-1 hover:text-purple-400 transition-colors">
														{movie.title}
													</h3>
													{movie.release_date && (
														<p className="text-gray-500 text-sm">
															{movie.release_date.split("-")[0]}
														</p>
													)}
												</Link>
											</div>
										);
									})}
								</div>
							</TooltipProvider>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
