import {
	listsControllerAddItemToListMutation,
	listsControllerGetListsForItemOptions,
	listsControllerGetUserListsOptions,
	moviesControllerGetMovieWatchHistoryOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock,
	Heart,
	Loader2,
	Play,
	Plus,
	Share2,
	Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { useDiscoverMovies, useMovieDetails } from "#/lib/hooks";
import MediaCard from "../../../components/MediaCard";

// Initialize API client
setupApiClient();

export const Route = createFileRoute("/movies/$movieId/$movieName")({
	component: MovieDetailPage,
});

function formatRuntime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours}h ${mins}m`;
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function MovieDetailPage() {
	const { movieId } = Route.useParams();
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did;
	const queryClient = useQueryClient();
	const [showListDropdown, setShowListDropdown] = useState(false);

	// Fetch movie details from API
	const { data: movie, isLoading, error } = useMovieDetails(movieId);
	const { data: similarMoviesData } = useDiscoverMovies(1);

	// Fetch user movies to check if this movie is tracked
	const { data: userMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: userDid || "" },
		}),
		enabled: !!userDid,
	});

	// Check if movie is in user's lists
	const { data: listsForItem } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "movie", mediaId: movieId },
		}),
		enabled: isAuthenticated,
	});

	// Fetch watch history for activity section
	const { data: watchHistory } = useQuery({
		...moviesControllerGetMovieWatchHistoryOptions({
			path: { userDid: userDid || "", movieId },
		}),
		enabled: !!userDid,
	});

	// Fetch user's lists for the dropdown
	const { data: userLists } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: isAuthenticated && showListDropdown,
	});

	// Check tracking status
	const isWatched = useMemo(() => {
		if (!userMovies || !Array.isArray(userMovies)) return false;
		return userMovies.some((um) => um.movieId === movieId);
	}, [userMovies, movieId]);

	const isInWatchlist = useMemo(() => {
		if (!listsForItem || !Array.isArray(listsForItem)) return false;
		return listsForItem.length > 0;
	}, [listsForItem]);

	const _watchedList = listsForItem?.find(
		(list) => list.listSlug === "watched",
	);
	const otherLists =
		listsForItem?.filter((list) => list.listSlug !== "watched") || [];

	// Mark watched mutation with optimistic update
	const markWatchedMutation = useMutation({
		mutationKey: ["movies", movieId, "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onMutate: async () => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({
				queryKey: ["moviesControllerGetUserMovies"],
			});
			await queryClient.cancelQueries({
				queryKey: ["listsControllerGetListsForItem"],
			});

			// Snapshot previous values
			const previousUserMovies = queryClient.getQueryData([
				"moviesControllerGetUserMovies",
			]);
			const previousListsForItem = queryClient.getQueryData([
				"listsControllerGetListsForItem",
			]);

			// Optimistically update
			queryClient.setQueryData(
				["moviesControllerGetUserMovies"],
				(old: unknown) => {
					if (!old || !Array.isArray(old)) return old;
					return [...old, { movieId: Number(movieId), title: movie?.title }];
				},
			);

			return { previousUserMovies, previousListsForItem };
		},
		onError: (_err, _variables, context) => {
			// Rollback on error
			if (context?.previousUserMovies) {
				queryClient.setQueryData(
					["moviesControllerGetUserMovies"],
					context.previousUserMovies,
				);
			}
			if (context?.previousListsForItem) {
				queryClient.setQueryData(
					["listsControllerGetListsForItem"],
					context.previousListsForItem,
				);
			}
		},
		onSettled: () => {
			// Always refetch after error or success
			queryClient.invalidateQueries({
				queryKey: ["moviesControllerGetUserMovies"],
			});
			queryClient.invalidateQueries({
				queryKey: ["moviesControllerGetMovieWatchHistory"],
			});
			queryClient.invalidateQueries({
				queryKey: ["listsControllerGetListsForItem"],
			});
		},
	});

	// Unmark watched mutation with optimistic update
	const unmarkWatchedMutation = useMutation({
		mutationKey: ["movies", movieId, "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onMutate: async () => {
			await queryClient.cancelQueries({
				queryKey: ["moviesControllerGetUserMovies"],
			});
			const previousUserMovies = queryClient.getQueryData([
				"moviesControllerGetUserMovies",
			]);

			queryClient.setQueryData(
				["moviesControllerGetUserMovies"],
				(old: unknown) => {
					if (!old || !Array.isArray(old)) return old;
					return old.filter(
						(m: { movieId: number }) => m.movieId !== Number(movieId),
					);
				},
			);

			return { previousUserMovies };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousUserMovies) {
				queryClient.setQueryData(
					["moviesControllerGetUserMovies"],
					context.previousUserMovies,
				);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: ["moviesControllerGetUserMovies"],
			});
			queryClient.invalidateQueries({
				queryKey: ["moviesControllerGetMovieWatchHistory"],
			});
		},
	});

	// Add to list mutation
	const addToListMutation = useMutation({
		mutationKey: ["lists", "addItem"],
		...listsControllerAddItemToListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["listsControllerGetListsForItem"],
			});
			queryClient.invalidateQueries({
				queryKey: ["listsControllerGetUserLists"],
			});
		},
	});

	const handleMarkWatched = () => {
		if (!isAuthenticated) return;
		markWatchedMutation.mutate({
			body: { movieId: movieId },
		});
	};

	const handleUnmarkWatched = () => {
		if (!isAuthenticated) return;
		unmarkWatchedMutation.mutate({
			path: { movieId: movieId },
		});
	};

	const handleAddToList = (slug: string) => {
		if (!isAuthenticated) return;
		addToListMutation.mutate({
			path: { slug },
			body: {
				mediaType: "movie",
				mediaId: movieId,
				title: movie?.title || "",
			},
		});
		setShowListDropdown(false);
	};

	// Get available lists (not already containing this movie)
	const availableLists = useMemo(() => {
		if (!userLists || !listsForItem) return [];
		const listIdsInItem = new Set(listsForItem.map((l) => l.listId));
		return userLists.filter((list) => !listIdsInItem.has(list.id));
	}, [userLists, listsForItem]);

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-12 w-12 animate-spin text-[var(--accent)]" />
			</div>
		);
	}

	if (error || !movie) {
		return (
			<div className="container-app py-8">
				<div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-800">
					<p className="text-lg font-medium">Failed to load movie</p>
					<p className="mt-2">Please check your connection and try again.</p>
					<Link to="/" className="btn btn-primary mt-4 inline-flex">
						Back to Dashboard
					</Link>
				</div>
			</div>
		);
	}

	// Transform API data
	const backdropUrl = movie.backdrop_path
		? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
		: movie.poster_path
			? `https://image.tmdb.org/t/p/original${movie.poster_path}`
			: "";
	const posterUrl = movie.poster_path
		? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
		: "";

	const director =
		movie.credits?.crew?.find((person) => person.job === "Director")?.name ||
		"Unknown";
	const cast =
		movie.credits?.cast?.slice(0, 6).map((actor) => ({
			name: actor.name,
			character: actor.character || "",
			photo: actor.profile_path
				? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
				: `https://i.pravatar.cc/150?u=${actor.id}`,
		})) || [];

	// Get similar movies from discover API, excluding current movie
	const similarMovies =
		similarMoviesData?.results
			?.filter((m) => m.id !== Number(movieId))
			?.slice(0, 4)
			?.map((m) => ({
				id: String(m.id),
				title: m.title,
				type: "movie" as const,
				year: m.release_date
					? new Date(m.release_date).getFullYear()
					: undefined,
				posterUrl: m.poster_path
					? `https://image.tmdb.org/t/p/w300${m.poster_path}`
					: "",
			})) || [];

	return (
		<div className="min-h-screen pb-8">
			{/* Hero Section with Backdrop */}
			<div className="relative z-10 min-h-[50vh] overflow-hidden">
				{/* Backdrop Image */}
				<div className="absolute inset-0 h-[60vh] overflow-hidden">
					<img
						src={backdropUrl}
						alt={movie.title}
						className="h-full w-full object-cover"
					/>
					{/* Gradient Overlays */}
					<div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/60 to-transparent" />
					<div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/40 to-transparent" />
				</div>

				{/* Content */}
				<div className="container-app relative pt-8">
					{/* Back Button */}
					<Link to="/" className="btn btn-secondary mb-6 inline-flex gap-2">
						<ChevronLeft className="h-4 w-4" />
						Back to Dashboard
					</Link>

					{/* Movie Info Header */}
					<div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
						{/* Poster */}
						<div className="hidden lg:block">
							<div className="aspect-[2/3] overflow-hidden rounded-xl shadow-2xl">
								<img
									src={posterUrl}
									alt={movie.title}
									className="h-full w-full object-cover"
								/>
							</div>
						</div>

						{/* Info */}
						<div className="flex flex-col justify-end pb-8 lg:pb-16">
							{/* Mobile Poster */}
							<div className="mb-6 flex gap-4 lg:hidden">
								<div className="h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg">
									<img
										src={posterUrl}
										alt={movie.title}
										className="h-full w-full object-cover"
									/>
								</div>
								<div className="flex flex-col justify-center">
									<h1 className="text-display-2">{movie.title}</h1>
									<p className="mt-2 text-lg text-[var(--foreground-muted)]">
										{/* Tagline not available in current API */}
									</p>
								</div>
							</div>

							{/* Desktop Title */}
							<div className="hidden lg:block">
								<h1 className="text-display-2">{movie.title}</h1>
								<p className="mt-2 text-xl text-[var(--foreground-muted)]">
									{/* Tagline not available in current API */}
								</p>
							</div>

							{/* Meta Info */}
							<div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
								<div className="flex items-center gap-1">
									<Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
									<span className="font-semibold">{movie.vote_average}</span>
									<span className="text-[var(--foreground-muted)]">/10</span>
								</div>
								<span className="text-[var(--border-strong)]">•</span>
								<span>{formatRuntime(movie.runtime || 0)}</span>
								<span className="text-[var(--border-strong)]">•</span>
								<span>
									{movie.release_date
										? new Date(movie.release_date).toLocaleDateString("en-US", {
												month: "long",
												day: "numeric",
												year: "numeric",
											})
										: "Unknown"}
								</span>
								<span className="text-[var(--border-strong)]">•</span>
								<div className="flex gap-2">
									{movie.genres?.map((g) => g.name) ||
										[].map((genre) => (
											<span key={genre} className="badge badge-subtle">
												{genre}
											</span>
										))}
								</div>
							</div>

							{/* Action Buttons */}
							<div className="mt-6 flex flex-wrap gap-3">
								<button type="button" className="btn btn-primary gap-2">
									<Play className="h-4 w-4" />
									Watch Trailer
								</button>

								{isWatched ? (
									<button
										type="button"
										onClick={handleUnmarkWatched}
										disabled={unmarkWatchedMutation.isPending}
										className="btn btn-secondary gap-2 bg-green-500/10 text-green-600 border-green-500/20"
									>
										{unmarkWatchedMutation.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Check className="h-4 w-4" />
										)}
										Watched
									</button>
								) : (
									<button
										type="button"
										onClick={handleMarkWatched}
										disabled={markWatchedMutation.isPending}
										className="btn btn-secondary gap-2"
									>
										{markWatchedMutation.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Check className="h-4 w-4" />
										)}
										Mark Watched
									</button>
								)}

								<div className="relative">
									<button
										type="button"
										onClick={() =>
											isAuthenticated && setShowListDropdown(!showListDropdown)
										}
										disabled={!isAuthenticated || addToListMutation.isPending}
										className={`btn gap-2 ${
											isInWatchlist
												? "btn-secondary bg-[var(--accent-subtle)] text-[var(--accent)]"
												: "btn-secondary"
										}`}
									>
										{addToListMutation.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : isInWatchlist ? (
											<>
												<Check className="h-4 w-4" />
												In List
												<ChevronDown className="h-3 w-3" />
											</>
										) : (
											<>
												<Plus className="h-4 w-4" />
												Add to List
												<ChevronDown className="h-3 w-3" />
											</>
										)}
									</button>

									{/* List Dropdown */}
									{showListDropdown && availableLists.length > 0 && (
										<div className="absolute top-full left-0 mt-2 w-56 rounded-lg border border-[var(--border-subtle)] bg-[var(--background-elevated)] shadow-lg z-50">
											<div className="p-2">
												<p className="px-2 py-1 text-xs font-medium text-[var(--foreground-muted)]">
													Add to list
												</p>
												{availableLists.map((list) => (
													<button
														key={list.slug}
														type="button"
														onClick={() => handleAddToList(list.slug)}
														className="w-full text-left px-2 py-2 text-sm rounded-md hover:bg-[var(--background-subtle)] transition-colors"
													>
														{list.name}
													</button>
												))}
											</div>
										</div>
									)}

									{showListDropdown && availableLists.length === 0 && (
										<div className="absolute top-full left-0 mt-2 w-56 rounded-lg border border-[var(--border-subtle)] bg-[var(--background-elevated)] shadow-lg z-50">
											<div className="p-3 text-center">
												<p className="text-sm text-[var(--foreground-muted)]">
													Already in all your lists
												</p>
											</div>
										</div>
									)}
								</div>

								<button
									type="button"
									className="btn btn-secondary h-10 w-10 p-0"
									aria-label="Share"
								>
									<Share2 className="h-4 w-4" />
								</button>

								<button
									type="button"
									className="btn btn-secondary h-10 w-10 p-0"
									aria-label="Like"
								>
									<Heart className="h-4 w-4" />
								</button>
							</div>

							{/* Tracking Badges */}
							{isAuthenticated && (isWatched || isInWatchlist) && (
								<div className="mt-3 flex flex-wrap gap-2">
									{isWatched && (
										<span className="badge badge-subtle bg-green-500/10 text-green-600 border-green-500/20">
											<Check className="h-3 w-3 mr-1" />
											Watched
										</span>
									)}
									{otherLists.map((list) => (
										<span key={list.listSlug} className="badge badge-subtle">
											In {list.listName}
										</span>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="container-app relative z-20 mt-8">
				<div className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:gap-12">
					{/* Left Column */}
					<div className="space-y-8">
						{/* Overview */}
						<section>
							<h2 className="text-display-3 mb-4">Overview</h2>
							<p className="text-[var(--foreground-muted)] leading-relaxed">
								{movie.overview}
							</p>
						</section>

						{/* Cast */}
						<section>
							<h2 className="text-display-3 mb-4">Cast</h2>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{cast.map((actor) => (
									<div
										key={actor.name}
										className="card card-interactive flex items-center gap-3 p-3"
									>
										<img
											src={actor.photo}
											alt={actor.name}
											className="h-12 w-12 rounded-full object-cover"
										/>
										<div className="min-w-0">
											<p className="font-medium text-sm truncate">
												{actor.name}
											</p>
											<p className="text-xs text-[var(--foreground-muted)] truncate">
												{actor.character}
											</p>
										</div>
									</div>
								))}
							</div>
						</section>

						{/* Similar Movies */}
						<section>
							<h2 className="text-display-3 mb-4">Similar Movies</h2>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
								{similarMovies.map((similarMovie) => (
									<MediaCard
										key={similarMovie.id}
										id={similarMovie.id}
										title={similarMovie.title}
										posterUrl={similarMovie.posterUrl}
										type={similarMovie.type}
										year={similarMovie.year}
										rating={similarMovie.rating}
										size="sm"
										layout="poster"
									/>
								))}
							</div>
						</section>
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6">
						{/* Details Card */}
						<section className="card p-5">
							<h3 className="font-display font-semibold mb-4">Details</h3>
							<div className="space-y-3 text-sm">
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">
										Director
									</span>
									<span className="font-medium">{director}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">
										Runtime
									</span>
									<span className="font-medium">
										{formatRuntime(movie.runtime || 0)}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">
										Release
									</span>
									<span className="font-medium">
										{movie.release_date
											? new Date(movie.release_date).toLocaleDateString(
													"en-US",
													{ month: "long", day: "numeric", year: "numeric" },
												)
											: "Unknown"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">Genres</span>
									<span className="font-medium text-right">
										{movie.genres?.map((g) => g.name) || [].join(", ")}
									</span>
								</div>
							</div>
						</section>

						{/* Your Activity */}
						<section className="card p-5">
							<h3 className="font-display font-semibold mb-4">Your Activity</h3>
							{watchHistory &&
							Array.isArray(watchHistory) &&
							watchHistory.length > 0 ? (
								<div className="space-y-3">
									{watchHistory.map((entry, index) => (
										<div
											key={entry.id || index}
											className="flex items-center gap-2 text-green-600"
										>
											<Check className="h-5 w-5" />
											<span className="font-medium">
												Watched on {formatDate(entry.watchedDate)}
											</span>
										</div>
									))}
								</div>
							) : (
								<div className="empty-state p-0">
									<Clock className="h-10 w-10 text-[var(--foreground-subtle)]" />
									<p className="mt-2 text-sm text-[var(--foreground-muted)]">
										You haven't watched this yet
									</p>
								</div>
							)}
						</section>

						{/* Lists Containing This */}
						<section className="card p-5">
							<h3 className="font-display font-semibold mb-4">In Your Lists</h3>
							<div className="space-y-2">
								{otherLists.length > 0 ? (
									otherLists.map((list) => (
										<Link
											key={list.listSlug}
											to={`/lists/${list.listSlug}` as "/lists/$slug"}
											className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-[var(--background-subtle)]"
										>
											<span className="text-sm font-medium">
												{list.listName}
											</span>
											<ChevronRight className="h-4 w-4 text-[var(--foreground-muted)]" />
										</Link>
									))
								) : (
									<p className="text-sm text-[var(--foreground-muted)]">
										Not in any custom lists yet
									</p>
								)}
							</div>
							{availableLists.length > 0 && (
								<button
									type="button"
									onClick={() => setShowListDropdown(!showListDropdown)}
									className="mt-3 w-full btn btn-secondary text-sm"
								>
									<Plus className="h-4 w-4" />
									Add to another list
								</button>
							)}
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
