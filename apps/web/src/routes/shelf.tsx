import {
	authControllerMeOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Loader2, LogIn, Trash2 } from "lucide-react";
import { toast } from "sonner";

function createTitleSlug(title: string): string {
	return title
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

export const Route = createFileRoute("/shelf")({
	head: () => ({
		meta: [{ title: "My Shelf | OpnShelf" }],
	}),
	component: ShelfPage,
});

function ShelfPage() {
	const queryClient = useQueryClient();

	// Fetch auth state using generated TanStack Query hook
	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	// Fetch user's tracked movies using generated TanStack Query hook
	const { data: trackedMovies, isLoading: isMoviesLoading } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	// Mutation for removing from shelf using generated TanStack Query hook
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

	if (isAuthLoading) {
		return (
			<div className="min-h-screen bg-gray-950 text-gray-50">
				<div className="container mx-auto px-4 py-8 max-w-7xl">
					<div className="flex justify-center py-12">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
					</div>
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen bg-gray-950 text-gray-50">
				<div className="container mx-auto px-4 py-16 max-w-4xl">
					<div className="text-center">
						<BookOpen className="w-16 h-16 text-purple-500 mx-auto mb-6" />
						<h1 className="text-4xl font-bold mb-4">My Shelf</h1>
						<p className="text-xl text-gray-400 mb-8">
							Sign in to track movies you've watched
						</p>
						<Link
							to="/login"
							className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
						>
							<LogIn className="w-5 h-5" />
							Sign in
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-8 max-w-7xl">
				<div className="flex items-center gap-3 mb-8">
					<BookOpen className="w-8 h-8 text-purple-500" />
					<h1 className="text-4xl font-bold">My Shelf</h1>
				</div>

				{isMoviesLoading && (
					<div className="flex justify-center py-12">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
					</div>
				)}

				{trackedMovies && trackedMovies.length > 0 && (
					<div>
						<p className="text-gray-400 mb-6">
							{trackedMovies.length} movie
							{trackedMovies.length !== 1 ? "s" : ""} watched
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
							{trackedMovies.map((tracked) => (
								<div key={tracked.id} className="group relative">
									<Link
										to="/movies/$movieId/$title"
										params={{
											movieId: tracked.movieId,
											title: createTitleSlug(tracked.movie.title),
										}}
										className="block relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2"
									>
										{tracked.movie.posterPath ? (
											<img
												src={`https://image.tmdb.org/t/p/w342${tracked.movie.posterPath}`}
												alt={tracked.movie.title}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center text-gray-600">
												No poster
											</div>
										)}
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												unmarkMutation.mutate({
													path: { movieId: tracked.movieId },
												});
											}}
											disabled={
												unmarkMutation.isPending &&
												unmarkMutation.variables?.path?.movieId ===
													tracked.movieId
											}
											className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-full [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity disabled:opacity-50"
											title="Remove from shelf"
										>
											{unmarkMutation.isPending &&
											unmarkMutation.variables?.path?.movieId ===
												tracked.movieId ? (
												<Loader2 className="w-4 h-4 animate-spin" />
											) : (
												<Trash2 className="w-4 h-4" />
											)}
										</button>
									</Link>
									<Link
										to="/movies/$movieId/$title"
										params={{
											movieId: tracked.movieId,
											title: createTitleSlug(tracked.movie.title),
										}}
										className="block"
									>
										<h3 className="font-semibold text-sm line-clamp-2 mb-1 hover:text-purple-400 transition-colors">
											{tracked.movie.title}
										</h3>
										{tracked.movie.releaseYear && (
											<p className="text-gray-500 text-sm">
												{tracked.movie.releaseYear}
											</p>
										)}
										{tracked.watchedDate && (
											<p className="text-gray-400 text-xs mt-1">
												Watched{" "}
												{new Date(tracked.watchedDate).toLocaleDateString(
													"en-US",
													{
														month: "short",
														day: "numeric",
														year: "numeric",
													},
												)}
											</p>
										)}
									</Link>
								</div>
							))}
						</div>
					</div>
				)}

				{trackedMovies && trackedMovies.length === 0 && (
					<div className="text-center py-12">
						<BookOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
						<p className="text-gray-400 text-lg mb-4">Your shelf is empty</p>
						<Link
							to="/search"
							search={{ q: "" }}
							className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
						>
							Search for movies
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
