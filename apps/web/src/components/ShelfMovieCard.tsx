import {
	moviesControllerUnmarkWatchedMutation,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

export interface ShelfMovieItem {
	id: string;
	type: "movie";
	movieId: string;
	title: string;
	posterPath?: string;
	backdropPath?: string;
	releaseYear?: number;
	overview?: string;
	colors?: unknown;
	watchedDate?: string;
	createdAt: string;
}

interface ShelfMovieCardProps {
	tracked: ShelfMovieItem;
	user: UserDto | undefined;
	readOnly?: boolean;
}

export function ShelfMovieCard({
	tracked,
	user,
	readOnly = false,
}: ShelfMovieCardProps) {
	const queryClient = useQueryClient();
	const { formatDate } = useFormattedDate();

	const unmarkMutation = useMutation({
		mutationKey: ["movies", tracked.movieId, "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			const userDid = user?.did;
			if (userDid) {
				invalidateUserShelfQueries(queryClient, userDid);
			}
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const posterUrl = getTmdbPosterUrl(tracked.posterPath);
	const formattedDate = useMemo(() => {
		if (!tracked.watchedDate) return null;
		return formatDate(tracked.watchedDate);
	}, [tracked.watchedDate, formatDate]);

	return (
		<div
			className="group rounded-[24px] border p-3 transition-transform duration-200 hover:-translate-y-1"
			style={{
				backgroundColor: "var(--md-sys-color-surface-container-low)",
				borderColor: "var(--md-sys-color-outline-variant)",
			}}
		>
			<Link
				to="/movies/$movieId/$title"
				params={{
					movieId: tracked.movieId,
					title: createTitleSlug(tracked.title),
				}}
				className="block relative mb-3 overflow-hidden rounded-[20px]"
			>
				<div
					className="aspect-2/3"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container-highest)",
					}}
				>
					{posterUrl ? (
						<img
							src={posterUrl}
							alt={tracked.title}
							className="h-full w-full object-cover"
						/>
					) : (
						<div
							className="flex h-full w-full items-center justify-center px-4 text-center text-sm"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							No poster available
						</div>
					)}
				</div>
				{readOnly ? null : (
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
				)}
			</Link>
			<Link
				to="/movies/$movieId/$title"
				params={{
					movieId: tracked.movieId,
					title: createTitleSlug(tracked.title),
				}}
				className="block rounded-[20px] px-1 pb-1"
			>
				<h3 className="mb-1 line-clamp-2 text-sm font-semibold transition-colors hover:text-[var(--md-sys-color-primary)]">
					{tracked.title}
				</h3>
				{tracked.releaseYear && (
					<p
						className="text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{tracked.releaseYear}
					</p>
				)}
				{formattedDate && (
					<p
						className="mt-2 text-xs"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Watched {formattedDate}
					</p>
				)}
			</Link>
		</div>
	);
}
