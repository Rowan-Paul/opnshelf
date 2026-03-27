import {
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

export interface ShelfEpisodeItem {
	id: string;
	type: "episode";
	showId: string;
	showTitle: string;
	seasonNumber: number;
	episodeNumber: number;
	posterPath?: string;
	backdropPath?: string;
	firstAirYear?: number;
	overview?: string;
	colors?: unknown;
	watchedDate?: string;
	createdAt: string;
}

interface ShelfEpisodeCardProps {
	tracked: ShelfEpisodeItem;
	user: UserDto | undefined;
	readOnly?: boolean;
}

export function ShelfEpisodeCard({
	tracked,
	user,
	readOnly = false,
}: ShelfEpisodeCardProps) {
	const queryClient = useQueryClient();
	const { formatDate } = useFormattedDate();

	const deleteMutation = useMutation({
		mutationKey: [
			"shows",
			tracked.showId,
			"episodes",
			tracked.episodeNumber,
			"deleteWatchEntry",
		],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			const userDid = user?.did;
			if (userDid) {
				invalidateUserShelfQueries(queryClient, userDid);
				invalidateUserUpNextQueries(queryClient, userDid);
			}
			toast.success("Episode removed from history");
		},
		onError: () => {
			toast.error("Failed to remove episode. Please try again.");
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
				to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
				params={{
					showId: tracked.showId,
					title: createTitleSlug(tracked.showTitle),
					seasonNumber: String(tracked.seasonNumber),
					episodeNumber: String(tracked.episodeNumber),
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
							alt={tracked.showTitle}
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
				<div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3">
					<div className="text-white text-sm font-medium">
						S{tracked.seasonNumber} E{tracked.episodeNumber}
					</div>
				</div>
				{readOnly ? null : (
					<Button
						type="button"
						size="icon"
						variant="destructive"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							deleteMutation.mutate({
								path: { trackedEpisodeId: tracked.id },
							});
						}}
						disabled={deleteMutation.isPending}
						className="absolute top-2 right-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"
						title="Remove from history"
					>
						{deleteMutation.isPending ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Trash2 className="w-4 h-4" />
						)}
					</Button>
				)}
			</Link>
			<Link
				to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
				params={{
					showId: tracked.showId,
					title: createTitleSlug(tracked.showTitle),
					seasonNumber: String(tracked.seasonNumber),
					episodeNumber: String(tracked.episodeNumber),
				}}
				className="block rounded-[20px] px-1 pb-1"
			>
				<h3 className="mb-1 line-clamp-2 text-sm font-semibold transition-colors hover:text-(--md-sys-color-primary)">
					{tracked.showTitle}
				</h3>
				<p
					className="text-sm"
					style={{ color: "var(--md-sys-color-on-surface-variant)" }}
				>
					S{tracked.seasonNumber} E{tracked.episodeNumber}
				</p>
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
