import {
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerUnmarkWatchedMutation,
	type TrackedMovieDto,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

interface ShelfMovieCardProps {
	tracked: TrackedMovieDto;
	user: UserDto;
}

export function ShelfMovieCard({ tracked, user }: ShelfMovieCardProps) {
	const queryClient = useQueryClient();
	const { formatDate } = useFormattedDate();

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

	const posterUrl = getTmdbPosterUrl(tracked.movie.posterPath);
	const formattedDate = useMemo(() => {
		if (!tracked.watchedDate) return null;
		return formatDate(tracked.watchedDate);
	}, [tracked.watchedDate, formatDate]);

	return (
		<div className="group relative">
			<Link
				to="/movies/$movieId/$title"
				params={{
					movieId: tracked.movieId,
					title: createTitleSlug(tracked.movie.title),
				}}
				className="block relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2"
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={tracked.movie.title}
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-gray-600">
						No poster
					</div>
				)}
				<Button
					type="button"
					size="icon"
					variant="destructive"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						unmarkMutation.mutate({
							path: { movieId: tracked.movieId },
						});
					}}
					disabled={
						unmarkMutation.isPending &&
						unmarkMutation.variables?.path?.movieId === tracked.movieId
					}
					className="absolute top-2 right-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"
					title="Remove from shelf"
				>
					{unmarkMutation.isPending &&
					unmarkMutation.variables?.path?.movieId === tracked.movieId ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<Trash2 className="w-4 h-4" />
					)}
				</Button>
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
					<p className="text-gray-500 text-sm">{tracked.movie.releaseYear}</p>
				)}
				{formattedDate && (
					<p className="text-gray-400 text-xs mt-1">
						Watched {formattedDate}
						{((tracked as unknown as { watchCount?: number }).watchCount ?? 0) >
						1 ? (
							<Badge variant="secondary" className="ml-2 text-xs">
								{(tracked as unknown as { watchCount?: number }).watchCount}×
							</Badge>
						) : null}
					</p>
				)}
			</Link>
		</div>
	);
}
