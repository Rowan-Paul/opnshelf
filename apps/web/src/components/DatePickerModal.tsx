import {
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerMarkShowWatchedMutation,
	showsControllerMarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { M3Button } from "@/components/ui/m3-button";
import { MaterialDatePicker } from "@/components/ui/material-date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";

type DatePickerModalProps = {
	open: boolean;
	onClose: () => void;
	userDid: string | undefined;
	modalTitle?: string;
} & (
	| {
			mode?: "movie";
			movieId: string;
	  }
	| {
			mode: "episode";
			showId: string;
			seasonNumber: string;
			episodeNumber: string;
	  }
	| {
			mode: "season";
			showId: string;
			seasonNumber: string;
	  }
	| {
			mode: "show";
			showId: string;
	  }
);

export function DatePickerModal({
	open,
	onClose,
	userDid,
	modalTitle,
	...target
}: DatePickerModalProps) {
	const queryClient = useQueryClient();
	const [customDate, setCustomDate] = useState("");
	const [timeDate, setTimeDate] = useState<Date | undefined>(undefined);

	useEffect(() => {
		if (open) {
			const now = new Date();
			setCustomDate(now.toISOString().split("T")[0]);
			setTimeDate(now);
		}
	}, [open]);

	const isMovieMode = target.mode === undefined || target.mode === "movie";
	const isEpisodeMode = target.mode === "episode";
	const isSeasonMode = target.mode === "season";
	const isShowMode = target.mode === "show";

	const markMutation = useMutation({
		mutationKey: ["movies", isMovieMode ? target.movieId : "", "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			if (isEpisodeMode) {
				return;
			}
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: userDid || "" },
				}),
			});
			invalidateUserShelfQueries(queryClient, userDid);
			if (isMovieMode) {
				queryClient.invalidateQueries({
					queryKey: ["watchHistory", userDid, target.movieId],
				});
			}
			toast.success("Added to your shelf");
			onClose();
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});
	const markEpisodeMutation = useMutation({
		mutationKey: [
			"shows",
			isEpisodeMode ? target.showId : "",
			"episodes",
			isEpisodeMode ? target.episodeNumber : "",
			"markWatched",
		],
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			if (isEpisodeMode) {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetUserShowsQueryKey({
						path: { userDid: userDid || "" },
					}),
				});
				invalidateUserShelfQueries(queryClient, userDid);
				queryClient.invalidateQueries({
					queryKey: showsControllerGetShowWatchHistoryQueryKey({
						path: { userDid: userDid || "", showId: target.showId },
					}),
				});
				toast.success("Added to your shelf");
				onClose();
			}
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});
	const markSeasonMutation = useMutation({
		mutationKey: [
			"shows",
			isSeasonMode ? target.showId : "",
			"seasons",
			isSeasonMode ? target.seasonNumber : "",
			"markSeasonWatched",
		],
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: () => {
			if (isSeasonMode) {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetUserShowsQueryKey({
						path: { userDid: userDid || "" },
					}),
				});
				invalidateUserShelfQueries(queryClient, userDid);
				queryClient.invalidateQueries({
					queryKey: showsControllerGetShowWatchHistoryQueryKey({
						path: { userDid: userDid || "", showId: target.showId },
					}),
				});
				toast.success("Added to your shelf");
				onClose();
			}
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});
	const markShowMutation = useMutation({
		mutationKey: ["shows", isShowMode ? target.showId : "", "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: () => {
			if (isShowMode) {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetUserShowsQueryKey({
						path: { userDid: userDid || "" },
					}),
				});
				invalidateUserShelfQueries(queryClient, userDid);
				queryClient.invalidateQueries({
					queryKey: showsControllerGetShowWatchHistoryQueryKey({
						path: { userDid: userDid || "", showId: target.showId },
					}),
				});
				toast.success("Added to your shelf");
				onClose();
			}
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const handleSubmit = () => {
		if (!customDate) return;

		let dateTime: Date;
		if (timeDate && customDate) {
			const [year, month, day] = customDate.split("-").map(Number);
			dateTime = new Date(timeDate);
			dateTime.setFullYear(year);
			dateTime.setMonth(month - 1);
			dateTime.setDate(day);
		} else if (customDate) {
			dateTime = new Date(customDate);
		} else {
			return;
		}

		if (isEpisodeMode) {
			markEpisodeMutation.mutate({
				body: {
					showId: target.showId,
					seasonNumber: Number(target.seasonNumber),
					episodeNumber: Number(target.episodeNumber),
					watchedAt: dateTime.toISOString(),
				},
			});
			return;
		}

		if (isSeasonMode) {
			markSeasonMutation.mutate({
				body: {
					showId: target.showId,
					seasonNumber: Number(target.seasonNumber),
					watchedAt: dateTime.toISOString(),
				},
			});
			return;
		}

		if (isShowMode) {
			markShowMutation.mutate({
				body: {
					showId: target.showId,
					watchedAt: dateTime.toISOString(),
				},
			});
			return;
		}

		markMutation.mutate({
			body: {
				movieId: target.movieId,
				watchedAt: dateTime.toISOString(),
			},
		});
	};

	const handleDateSelect = (date: Date) => {
		setCustomDate(format(date, "yyyy-MM-dd"));
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
			<div className="bg-(--md-sys-color-surface-container-high) rounded-xl p-6 max-w-sm w-full">
				<div className="flex justify-between items-center mb-6">
					<h3 className="text-xl font-semibold text-(--md-sys-color-on-surface)">
						{modalTitle || "Select date"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="p-2 hover:bg-(--md-sys-color-surface-container-highest) rounded-full transition-colors text-(--md-sys-color-on-surface-variant)"
					>
						<X className="w-5 h-5" />
					</button>
				</div>
				<div className="space-y-4">
					<MaterialDatePicker
						selected={customDate ? new Date(customDate) : new Date()}
						onSelect={handleDateSelect}
					/>
					<div>
						<TimePicker date={timeDate} setDate={setTimeDate} />
					</div>
					<div className="flex gap-3 pt-4">
						<M3Button
							type="button"
							variant="outlined"
							onClick={onClose}
							className="flex-1 border-(--md-sys-color-outline) text-(--md-sys-color-on-surface) hover:bg-(--md-sys-color-surface-container-highest)"
						>
							Cancel
						</M3Button>
						<M3Button
							type="button"
							variant="filled"
							onClick={handleSubmit}
							disabled={!customDate}
							isLoading={
								markMutation.isPending || markEpisodeMutation.isPending
							}
							className="flex-1"
						>
							Add Watch
						</M3Button>
					</div>
				</div>
			</div>
		</div>
	);
}
