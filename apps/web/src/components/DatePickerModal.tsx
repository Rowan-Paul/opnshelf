import {
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingButton } from "@/components/ui/loading-button";
import { M3Button } from "@/components/ui/m3-button";
import { MaterialDatePicker } from "@/components/ui/material-date-picker";
import { TimePicker } from "@/components/ui/time-picker";

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

	const markMutation = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			if (target.mode === "episode") {
				return;
			}
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: userDid || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", userDid, target.movieId],
			});
			toast.success("Added to your shelf");
			onClose();
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});
	const markEpisodeMutation = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			if (target.mode === "episode") {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetUserShowsQueryKey({
						path: { userDid: userDid || "" },
					}),
				});
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

		if (target.mode === "episode") {
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
			<div className="bg-(--md-sys-color-surface-container-high) rounded-[1.75rem] p-6 max-w-sm w-full">
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
						<LoadingButton
							type="button"
							onClick={handleSubmit}
							disabled={
								!customDate ||
								markMutation.isPending ||
								markEpisodeMutation.isPending
							}
							className="flex-1 bg-(--md-sys-color-primary) hover:bg-(--md-sys-color-primary)/90"
							isLoading={
								markMutation.isPending || markEpisodeMutation.isPending
							}
						>
							Add Watch
						</LoadingButton>
					</div>
				</div>
			</div>
		</div>
	);
}
