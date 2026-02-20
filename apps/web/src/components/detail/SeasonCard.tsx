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
			}
			toast.success(`Marked ${data.count} episodes as watched`);
		},
		onError: () => {
			toast.error("Failed to mark season as watched");
		},
	});

	const unmarkMutation = useMutation({
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
			className="group block rounded-xl border bg-gray-900/30 hover:bg-gray-900/50 transition-all overflow-hidden"
			style={{ borderColor: "var(--md-sys-color-outline)" }}
		>
			<div className="grid grid-cols-[100px_1fr] gap-4">
				<div className="aspect-2/3 bg-gray-900 relative">
					{posterUrl ? (
						<img
							src={posterUrl}
							alt={`Season ${seasonNumber}`}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
							No poster
						</div>
					)}
				</div>
				<div className="py-3 pr-4 min-w-0">
					<div className="flex items-center justify-between gap-2 mb-1">
						<h3
							className="font-semibold text-lg group-hover:text-white transition-colors"
							style={{ color: colors.primary }}
						>
							Season {seasonNumber}
						</h3>
						{airDate && (
							<span className="text-xs text-gray-400 flex items-center gap-1">
								<Calendar className="w-3 h-3" />
								{new Date(airDate).getFullYear()}
							</span>
						)}
					</div>

					<div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
						<span className="flex items-center gap-1">
							<Film className="w-3 h-3" />
							{episodeCount} episodes
						</span>
						{watchedCount > 0 && (
							<span className="text-gray-300">{watchedCount} watched</span>
						)}
					</div>

					{overview && (
						<p className="text-xs text-gray-400 line-clamp-2 mb-3">
							{overview}
						</p>
					)}

					{episodeCount > 0 && (
						<div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
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
							className={`flex items-center gap-1 px-4 py-2 rounded-md text-xs font-medium transition-all mt-2 ${hasWatchedEpisodes ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500"}`}
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
