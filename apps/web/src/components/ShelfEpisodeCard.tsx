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
}

export function ShelfEpisodeCard({ tracked, user }: ShelfEpisodeCardProps) {
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
			queryClient.invalidateQueries({ queryKey: ["shelf", "user", user?.did] });
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
		<div className="group relative">
			<Link
				to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
				params={{
					showId: tracked.showId,
					title: createTitleSlug(tracked.showTitle),
					seasonNumber: String(tracked.seasonNumber),
					episodeNumber: String(tracked.episodeNumber),
				}}
				className="block relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2"
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={tracked.showTitle}
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-gray-600">
						No poster
					</div>
				)}
				<div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3">
					<div className="text-white text-sm font-medium">
						S{tracked.seasonNumber} E{tracked.episodeNumber}
					</div>
				</div>
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
			</Link>
			<Link
				to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
				params={{
					showId: tracked.showId,
					title: createTitleSlug(tracked.showTitle),
					seasonNumber: String(tracked.seasonNumber),
					episodeNumber: String(tracked.episodeNumber),
				}}
				className="block"
			>
				<h3 className="font-semibold text-sm line-clamp-2 mb-1 hover:text-amber-400 transition-colors">
					{tracked.showTitle}
				</h3>
				<p className="text-gray-500 text-sm">
					S{tracked.seasonNumber} E{tracked.episodeNumber}
				</p>
				{formattedDate && (
					<p className="text-gray-400 text-xs mt-1">Watched {formattedDate}</p>
				)}
			</Link>
		</div>
	);
}
