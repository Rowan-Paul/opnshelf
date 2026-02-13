import {
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetUserMoviesQueryKey,
	type WatchHistoryItemDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
			<DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="w-5 h-5" />
						Watch History
					</DialogTitle>
					<DialogDescription className="text-gray-400">
						All the times you&apos;ve watched {movieTitle}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
					{watchHistory && watchHistory.length > 0 ? (
						watchHistory.map((watch) => (
							<div
								key={watch.id}
								className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50"
							>
								<div className="flex-1">
									<p className="text-sm font-medium text-white">
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
									className="shrink-0 p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
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
						<div className="text-center py-8 text-gray-500">
							No watch history found
						</div>
					)}
				</div>
				<div className="mt-4 flex justify-end">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						className="border-gray-700 text-white hover:bg-gray-800"
					>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
