import {
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

export interface MovieCardData {
	id: number;
	title: string;
	poster_path?: string | null;
	release_date?: string | null;
	releaseYear?: number | null;
}

interface MovieCardProps {
	movie: MovieCardData;
	user: UserDto | null | undefined;
	isWatched: boolean;
	showActions?: boolean;
}

export function MovieCard({
	movie,
	user,
	isWatched,
	showActions = true,
}: MovieCardProps) {
	const queryClient = useQueryClient();
	const movieId = movie.id.toString();

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

	const isMarkPending =
		markMutation.isPending && markMutation.variables?.body?.movieId === movieId;
	const isUnmarkPending =
		unmarkMutation.isPending &&
		unmarkMutation.variables?.path?.movieId === movieId;
	const isPending = isMarkPending || isUnmarkPending;

	const posterUrl = getTmdbPosterUrl(movie.poster_path);
	const releaseYear = movie.release_date
		? movie.release_date.split("-")[0]
		: movie.releaseYear;

	return (
		<div className="group">
			<Link
				to="/movies/$movieId/$title"
				params={{
					movieId: movieId,
					title: createTitleSlug(movie.title),
				}}
				className="block relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2"
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={movie.title}
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-gray-600">
						No poster
					</div>
				)}
				{showActions && user && (
					<div className="absolute top-2 right-2 z-10">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										size="icon"
										variant="default"
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
										disabled={isPending}
										className={`${
											isWatched
												? "bg-green-600 hover:bg-red-600"
												: "bg-primary hover:bg-primary/80 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
										} transition-opacity`}
									>
										{isPending ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : isWatched ? (
											<Check className="w-4 h-4" />
										) : (
											<Plus className="w-4 h-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>{isWatched ? "Remove from shelf" : "Mark as watched"}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
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
				{releaseYear && <p className="text-gray-500 text-sm">{releaseYear}</p>}
			</Link>
		</div>
	);
}
