import {
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Calendar, Film, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import type { ColorTheme } from "./types";

type SeasonCardProps = {
	showId: string;
	title: string;
	seasonNumber: number;
	posterUrl?: string | null;
	airDate?: string;
	episodeCount: number;
	watchedCount: number;
	overview?: string;
	colors: ColorTheme;
	showData?: { number_of_episodes?: number };
	userDid?: string;
};

export function SeasonCard({
	showId,
	title,
	seasonNumber,
	posterUrl,
	airDate,
	episodeCount,
	watchedCount,
	overview,
	colors,
	userDid,
}: SeasonCardProps) {
	const queryClient = useQueryClient();

	const progress =
		episodeCount > 0 ? Math.round((watchedCount / episodeCount) * 100) : 0;
	const hasWatchedEpisodes = watchedCount > 0;

	const markMutation = useMutation({
		mutationKey: [
			"shows",
			showId,
			"seasons",
			seasonNumber,
			"markSeasonWatched",
		],
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: (data) => {
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
			toast.success(`Marked ${data.count} episodes as watched`);
		},
		onError: () => {
			toast.error("Failed to mark season as watched");
		},
	});

	const unmarkMutation = useMutation({
		mutationKey: [
			"shows",
			showId,
			"seasons",
			seasonNumber,
			"unmarkSeasonWatched",
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
			toast.success("Removed season from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf");
		},
	});

	const isPending = markMutation.isPending || unmarkMutation.isPending;

	const handleToggleWatched = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (hasWatchedEpisodes) {
			unmarkMutation.mutate({
				path: { showId },
				query: {
					mode: "all",
					seasonNumber: String(seasonNumber),
				},
			});
		} else {
			markMutation.mutate({
				body: {
					showId,
					seasonNumber,
				},
			});
		}
	};

	return (
		<Link
			to="/shows/$showId/$title/seasons/$seasonNumber"
			params={{
				showId,
				title,
				seasonNumber: String(seasonNumber),
			}}
			className="group block rounded-xl border border-(--md-sys-color-outline) bg-(--md-sys-color-surface-container)/30 hover:bg-(--md-sys-color-surface-container)/50 transition-all overflow-hidden"
		>
			<div className="grid grid-cols-[100px_1fr] gap-4">
				<div className="aspect-2/3 bg-(--md-sys-color-surface-container) relative">
					{posterUrl ? (
						<img
							src={posterUrl}
							alt={`Season ${seasonNumber}`}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center text-(--md-sys-color-on-surface-variant) text-xs">
							No poster
						</div>
					)}
				</div>
				<div className="py-3 pr-4 min-w-0">
					<div className="flex items-center justify-between gap-2 mb-1">
						<h3
							className="font-semibold text-lg group-hover:text-(--md-sys-color-on-surface) transition-colors"
							style={{ color: colors.primary }}
						>
							Season {seasonNumber}
						</h3>
						{airDate && (
							<span className="text-xs text-(--md-sys-color-on-surface-variant) flex items-center gap-1">
								<Calendar className="w-3 h-3" />
								{new Date(airDate).getFullYear()}
							</span>
						)}
					</div>

					<div className="flex items-center gap-3 text-xs text-(--md-sys-color-on-surface-variant) mb-2">
						<span className="flex items-center gap-1">
							<Film className="w-3 h-3" />
							{episodeCount} episodes
						</span>
						{watchedCount > 0 && (
							<span className="text-(--md-sys-color-on-surface)">
								{watchedCount} watched
							</span>
						)}
					</div>

					{overview && (
						<p className="text-xs text-(--md-sys-color-on-surface-variant) line-clamp-2 mb-3">
							{overview}
						</p>
					)}

					{episodeCount > 0 && (
						<div className="w-full h-1.5 bg-(--md-sys-color-surface-container-high) rounded-full overflow-hidden mb-3">
							<div
								className="h-full rounded-full transition-all"
								style={{
									width: `${progress}%`,
									background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
								}}
							/>
						</div>
					)}

					{userDid && (
						<button
							type="button"
							onClick={handleToggleWatched}
							disabled={isPending}
							className={`flex items-center gap-1 px-4 py-2 rounded-sm text-xs font-medium transition-all mt-2 ${hasWatchedEpisodes ? "bg-(--md-sys-color-error)/20 text-(--md-sys-color-error)" : "bg-(--md-sys-color-tertiary)/20 text-(--md-sys-color-tertiary)"}`}
							title="Add to Shelf"
						>
							{isPending ? (
								<>
									<Loader2 className="w-3 h-3 animate-spin" />
									<span>Loading</span>
								</>
							) : (
								<>
									{hasWatchedEpisodes ? (
										<Trash2 className="w-3 h-3" />
									) : (
										<Plus className="w-3 h-3" />
									)}
									{hasWatchedEpisodes ? (
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
