import type { WatchHistoryItemDto } from "@opnshelf/api";
import {
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Calendar,
	Check,
	Eye,
	History,
	Loader2,
	Plus,
	RotateCcw,
	Share2,
	Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface MovieActionsProps {
	movieId: string;
	user: UserDto | null | undefined;
	isWatched: boolean;
	watchHistory: WatchHistoryItemDto[] | undefined;
	formattedWatchedDate: string | null;
	colors: {
		primary: string;
		secondary: string;
		accent: string;
		muted: string;
	};
	onOpenDateModal: () => void;
	onOpenHistoryDialog: () => void;
}

export function MovieActions({
	movieId,
	user,
	isWatched,
	watchHistory,
	formattedWatchedDate,
	colors,
	onOpenDateModal,
	onOpenHistoryDialog,
}: MovieActionsProps) {
	const queryClient = useQueryClient();

	const markMutation = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", user?.did, movieId],
			});
			toast.success("Added to your shelf");
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const unmarkMutation = useMutation({
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", user?.did, movieId],
			});
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf. Please try again.");
		},
	});

	const isPending =
		markMutation.isPending && markMutation.variables?.body?.movieId === movieId;

	const handleMarkWatched = () => {
		markMutation.mutate({ body: { movieId } });
	};

	const handleUnmarkWatched = () => {
		unmarkMutation.mutate({
			path: { movieId },
			query: { mode: "all" },
		});
	};

	const handleShare = async () => {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({ url });
			} catch {
				// User cancelled share
			}
		} else {
			try {
				await navigator.clipboard.writeText(url);
				toast.success("Link copied to clipboard");
			} catch {
				toast.error("Failed to copy link");
			}
		}
	};

	if (!user) {
		return (
			<Link
				to="/login"
				className="w-full py-4 px-6 rounded-xl font-semibold text-white text-lg text-center transition-all duration-200 block hover:scale-[1.02]"
				style={{
					background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
					boxShadow: `0 15px 35px -10px ${colors.primary}60`,
				}}
			>
				Sign in to Track
			</Link>
		);
	}

	if (!isWatched) {
		return (
			<div className="space-y-3">
				<Button
					type="button"
					onClick={handleMarkWatched}
					disabled={isPending}
					className="w-full py-4 px-6 rounded-xl font-semibold text-white text-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 hover:scale-[1.02]"
					style={{
						background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
						boxShadow: `0 15px 35px -10px ${colors.primary}60`,
					}}
				>
					{isPending ? (
						<>
							<Loader2 className="w-5 h-5 animate-spin" />
							Loading
						</>
					) : (
						<>
							<Plus className="w-5 h-5" />
							Add to Shelf
						</>
					)}
				</Button>
				<Button
					type="button"
					onClick={onOpenDateModal}
					variant="outline"
					className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border-gray-700"
				>
					<Calendar className="w-4 h-4" />
					Add on Different Date
				</Button>
				<Button
					type="button"
					onClick={handleShare}
					variant="outline"
					className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border-gray-700"
				>
					<Share2 className="w-4 h-4" />
					Share
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="p-4 rounded-xl bg-gray-900/50">
				<div className="flex items-center gap-2 text-green-400 mb-2">
					<Check className="w-5 h-5" />
					<span className="font-semibold">On Your Shelf</span>
				</div>
				{formattedWatchedDate && (
					<p className="text-sm text-gray-400">
						Watched on {formattedWatchedDate}
					</p>
				)}
				{watchHistory && watchHistory.length > 1 && (
					<>
						<div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
							<History className="w-3 h-3" />
							<span>{watchHistory.length} total watches</span>
						</div>
						<button
							type="button"
							onClick={onOpenHistoryDialog}
							className="mt-2 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2 px-3 -ml-3 rounded-lg hover:bg-gray-800/50"
						>
							<Eye className="w-4 h-4" />
							View all watches
						</button>
					</>
				)}
				{watchHistory && watchHistory.length === 1 && (
					<button
						type="button"
						onClick={handleUnmarkWatched}
						disabled={unmarkMutation.isPending}
						className="mt-2 flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors py-2 px-3 -ml-3 rounded-lg hover:bg-red-900/20 disabled:opacity-50"
					>
						{unmarkMutation.isPending ? (
							<>
								<span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
								Loading
							</>
						) : (
							<>
								<Trash2 className="w-4 h-4" />
								Remove from shelf
							</>
						)}
					</button>
				)}
			</div>
			<Button
				type="button"
				onClick={handleMarkWatched}
				disabled={isPending}
				className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 hover:scale-[1.02]"
				style={{
					background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
					boxShadow: `0 10px 30px -10px ${colors.primary}60`,
				}}
			>
				{isPending ? (
					<>
						<Loader2 className="w-4 h-4 animate-spin" />
						Loading
					</>
				) : (
					<>
						<RotateCcw className="w-4 h-4" />
						Watch Now
					</>
				)}
			</Button>
			<Button
				type="button"
				onClick={onOpenDateModal}
				variant="outline"
				className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border-gray-700"
			>
				<Calendar className="w-4 h-4" />
				Watch on Different Date
			</Button>
			<Button
				type="button"
				onClick={handleShare}
				variant="outline"
				className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border-gray-700"
			>
				<Share2 className="w-4 h-4" />
				Share
			</Button>
		</div>
	);
}
