import {
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkShowWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TmdbShowResultDto,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

interface ShowCardProps {
	show: TmdbShowResultDto;
	user: UserDto | null | undefined;
	isWatched: boolean;
	showActions?: boolean;
}

export function ShowCard({
	show,
	user,
	isWatched,
	showActions = true,
}: ShowCardProps) {
	const queryClient = useQueryClient();
	const showId = show.id.toString();

	const markMutation = useMutation({
		mutationKey: ["shows", showId, "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			invalidateUserShelfQueries(queryClient, user?.did);
			toast.success("Added to your shelf");
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const unmarkMutation = useMutation({
		mutationKey: ["shows", showId, "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			invalidateUserShelfQueries(queryClient, user?.did);
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const isMarkPending =
		markMutation.isPending && markMutation.variables?.body?.showId === showId;
	const isUnmarkPending =
		unmarkMutation.isPending &&
		unmarkMutation.variables?.path?.showId === showId;
	const isPending = isMarkPending || isUnmarkPending;

	const compatShow = show as TmdbShowResultDto & {
		posterPath?: string | null;
		firstAirDate?: string | null;
	};
	const posterUrl = getTmdbPosterUrl(
		show.poster_path ?? compatShow.posterPath ?? null,
	);
	const firstAirDate = show.first_air_date ?? compatShow.firstAirDate ?? null;
	const year = firstAirDate ? firstAirDate.split("-")[0] : undefined;

	return (
		<div className="group">
			<Link
				to="/shows/$showId/$title"
				params={{ showId, title: createTitleSlug(show.name) }}
				className="block relative aspect-2/3 rounded-lg overflow-hidden mb-2"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-high)",
				}}
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={show.name}
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				) : (
					<div
						className="w-full h-full flex items-center justify-center md-body-medium"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						No poster
					</div>
				)}
				{showActions && user && (
					<div className="absolute top-2 right-2 z-10">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										size="icon"
										variant="default"
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											if (isWatched) {
												unmarkMutation.mutate({
													path: { showId },
													query: { mode: "all" },
												});
											} else {
												markMutation.mutate({
													body: { showId },
												});
											}
										}}
										disabled={isPending}
										className={`${
											isWatched
												? "bg-green-600 hover:bg-red-600"
												: "bg-primary hover:bg-primary/80 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
										} transition-opacity`}
									>
										{isPending ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : isWatched ? (
											<Check className="w-4 h-4" />
										) : (
											<Plus className="w-4 h-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>{isWatched ? "Remove from shelf" : "Mark as watched"}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
				)}
			</Link>
			<Link
				to="/shows/$showId/$title"
				params={{ showId, title: createTitleSlug(show.name) }}
				className="block"
			>
				<h3 className="font-semibold text-sm line-clamp-2 mb-1 transition-colors hover:text-(--md-sys-color-primary)">
					{show.name}
				</h3>
				{year && (
					<p
						className="text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{year}
					</p>
				)}
			</Link>
		</div>
	);
}
