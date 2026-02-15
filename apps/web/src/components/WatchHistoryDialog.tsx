import {
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetUserMoviesQueryKey,
	type WatchHistoryItemDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { M3Button } from "@/components/ui/m3-button";
import { useFormattedDate } from "@/hooks/useFormattedDate";

interface WatchHistoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	movieTitle: string | undefined;
	watchHistory: WatchHistoryItemDto[] | undefined;
	userDid: string | undefined;
	movieId: string;
}

export function WatchHistoryDialog({
	open,
	onOpenChange,
	movieTitle,
	watchHistory,
	userDid,
	movieId,
}: WatchHistoryDialogProps) {
	const queryClient = useQueryClient();
	const { formatDate } = useFormattedDate();

	const deleteWatchEntryMutation = useMutation({
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: userDid || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", userDid, movieId],
			});
			toast.success("Watch entry removed");
		},
		onError: () => {
			toast.error("Failed to remove watch entry. Please try again.");
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[var(--md-sys-color-surface-container-high)] border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface)] max-w-md rounded-[1.75rem]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
						<History className="w-5 h-5" />
						Watch History
					</DialogTitle>
					<DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
						All the times you&apos;ve watched {movieTitle}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
					{watchHistory && watchHistory.length > 0 ? (
						watchHistory.map((watch) => (
							<div
								key={watch.id}
								className="flex items-center gap-3 p-3 rounded-lg bg-[var(--md-sys-color-surface-container-low)]"
							>
								<div className="flex-1">
									<p className="text-sm font-medium text-[var(--md-sys-color-on-surface)]">
										{formatDate(watch.watchedDate)}
									</p>
								</div>
								<button
									type="button"
									onClick={() =>
										deleteWatchEntryMutation.mutate({
											path: { trackedMovieId: watch.id },
										})
									}
									disabled={deleteWatchEntryMutation.isPending}
									className="shrink-0 p-2 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error)]/10 rounded-lg transition-colors disabled:opacity-50"
									title="Remove this watch"
								>
									{deleteWatchEntryMutation.isPending &&
									deleteWatchEntryMutation.variables?.path?.trackedMovieId ===
										watch.id ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<Trash2 className="w-4 h-4" />
									)}
								</button>
							</div>
						))
					) : (
						<div className="text-center py-8 text-[var(--md-sys-color-on-surface-variant)]">
							No watch history found
						</div>
					)}
				</div>
				<div className="mt-4 flex justify-end">
					<M3Button
						variant="outlined"
						onClick={() => onOpenChange(false)}
						className="border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]"
					>
						Close
					</M3Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
