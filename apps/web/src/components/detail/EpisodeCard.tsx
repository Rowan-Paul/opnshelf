import {
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Calendar, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import { formatDateOnly } from "@/lib/utils";
import type { ColorTheme, EpisodeSummary } from "./types";

type EpisodeCardProps = {
	showId: string;
	title: string;
	seasonNumber: string;
	episode: EpisodeSummary;
	watchedCount?: number;
	colors: ColorTheme;
	userDid?: string;
};

export function EpisodeCard({
	showId,
	title,
	seasonNumber,
	episode,
	watchedCount = 0,
	colors,
	userDid,
}: EpisodeCardProps) {
	const queryClient = useQueryClient();

	const markMutation = useMutation({
		mutationKey: [
			"shows",
			showId,
			"episodes",
			episode.episode_number,
			"markWatched",
		],
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			if (userDid) {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetUserShowsQueryKey({
						path: { userDid },
					}),
				});
				queryClient.invalidateQueries({
					queryKey: showsControllerGetShowWatchHistoryQueryKey({
						path: { userDid, showId },
					}),
				});
				invalidateUserShelfQueries(queryClient, userDid);
			}
			toast.success("Episode marked watched");
		},
		onError: () => {
			toast.error("Failed to mark episode watched");
		},
	});

	const unmarkMutation = useMutation({
		mutationKey: [
			"shows",
			showId,
			"episodes",
			episode.episode_number,
			"unmarkWatched",
		],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			if (userDid) {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetUserShowsQueryKey({
						path: { userDid },
					}),
				});
				queryClient.invalidateQueries({
					queryKey: showsControllerGetShowWatchHistoryQueryKey({
						path: { userDid, showId },
					}),
				});
				invalidateUserShelfQueries(queryClient, userDid);
			}
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf");
		},
	});

	const isPending = markMutation.isPending || unmarkMutation.isPending;

	const handleToggleWatched = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (watchedCount > 0) {
			unmarkMutation.mutate({
				path: { showId },
				query: {
					mode: "all",
					seasonNumber,
					episodeNumber: String(episode.episode_number),
				},
			});
		} else {
			markMutation.mutate({
				body: {
					showId,
					seasonNumber: Number(seasonNumber),
					episodeNumber: episode.episode_number,
				},
			});
		}
	};

	return (
		<Link
			to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
			params={{
				showId,
				title,
				seasonNumber,
				episodeNumber: String(episode.episode_number),
			}}
			className="group block rounded-xl border bg-(--md-sys-color-surface-container)/30 hover:bg-(--md-sys-color-surface-container)/50 transition-all overflow-hidden"
			style={{
				borderColor:
					watchedCount > 0
						? `${colors.primary}40`
						: "var(--md-sys-color-outline)",
			}}
		>
			<div className="grid grid-cols-[120px_1fr] gap-4">
				<div className="h-full bg-(--md-sys-color-surface-container) min-h-[67px] relative">
					{episode.still_path ? (
						<img
							src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
							alt={episode.name}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center text-(--md-sys-color-on-surface-variant) text-xs">
							No image
						</div>
					)}
				</div>
				<div className="p-3 min-w-0">
					<div className="flex items-center justify-between gap-2 mb-1">
						<p className="font-medium line-clamp-1 group-hover:text-(--md-sys-color-on-surface) transition-colors">
							E{episode.episode_number} · {episode.name}
						</p>
						{episode.vote_average ? (
							<span className="text-xs flex items-center gap-1 text-(--md-sys-color-on-surface-variant)">
								<Star className="w-3 h-3" />
								{episode.vote_average.toFixed(1)}
							</span>
						) : null}
					</div>
					<p className="text-xs text-(--md-sys-color-on-surface-variant) line-clamp-2 mb-2">
						{episode.overview || "No overview available."}
					</p>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-3 text-xs text-(--md-sys-color-on-surface-variant)">
							<span className="flex items-center gap-1">
								<Calendar className="w-3 h-3" />
								{episode.air_date ? formatDateOnly(episode.air_date) : "TBA"}
							</span>
						</div>
					</div>

					{userDid && (
						<button
							type="button"
							onClick={handleToggleWatched}
							disabled={isPending}
							className={`flex items-center gap-1 px-4 py-2 rounded-md text-xs font-medium transition-all mt-2 ${watchedCount > 0 ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500"}`}
							title="Add to Shelf"
						>
							{isPending ? (
								<>
									<Loader2 className="w-3 h-3 animate-spin" />
									<span>Loading</span>
								</>
							) : (
								<>
									{watchedCount > 0 ? (
										<Trash2 className="w-3 h-3" />
									) : (
										<Plus className="w-3 h-3" />
									)}
									{watchedCount > 0 ? (
										<span>Remove from Shelf</span>
									) : (
										<span>Add to Shelf</span>
									)}
								</>
							)}
						</button>
					)}
				</div>
			</div>
		</Link>
	);
}
