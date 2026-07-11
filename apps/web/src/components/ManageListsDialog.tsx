import { Check, Plus, X } from "lucide-react";
import { RowListSkeleton } from "#/components/skeletons";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useListActions, useListItemStatus } from "#/lib/hooks";

interface ManageListsDialogProps {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title?: string;
	description?: string;
}

export default function ManageListsDialog({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	open,
	onOpenChange,
	title = "Manage lists",
	description = "Add or remove this item from your lists",
}: ManageListsDialogProps) {
	const { customListsWithStatus, userLists, listsForItem } = useListItemStatus({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const {
		addToList,
		removeFromList,
		toggleWatchlist,
		toggleFavorites,
		isPending,
	} = useListActions({ mediaType, mediaId, seasonNumber, episodeNumber });

	const isLoading =
		!userLists || !listsForItem || customListsWithStatus === undefined;

	const isWatchlist =
		listsForItem?.some((l) => l.listSlug === "watchlist" && l.isInList) ??
		false;
	const isFavorites =
		listsForItem?.some((l) => l.listSlug === "favorites" && l.isInList) ??
		false;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<RowListSkeleton rows={3} />
				) : (
					<div className="space-y-1 py-2">
						{/* Watchlist */}
						<button
							type="button"
							onClick={() => toggleWatchlist(isWatchlist)}
							disabled={isPending}
							className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-(--background-subtle)"
						>
							<span>Watchlist</span>
							{isWatchlist ? (
								<Check className="size-4 text-green-500" />
							) : (
								<Plus className="size-4 text-(--foreground-muted)" />
							)}
						</button>

						{/* Favorites */}
						<button
							type="button"
							onClick={() => toggleFavorites(isFavorites)}
							disabled={isPending}
							className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-(--background-subtle)"
						>
							<span>Favorites</span>
							{isFavorites ? (
								<Check className="size-4 text-green-500" />
							) : (
								<Plus className="size-4 text-(--foreground-muted)" />
							)}
						</button>

						{/* Custom lists — stable combined list, never reorders on toggle */}
						{customListsWithStatus.map((list) => (
							<button
								key={list.slug}
								type="button"
								onClick={() =>
									list.isInList
										? removeFromList(list.slug)
										: addToList(list.slug)
								}
								disabled={isPending}
								className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-(--background-subtle)"
							>
								<span>{list.name}</span>
								{list.isInList ? (
									<Check className="size-4 text-green-500" />
								) : (
									<Plus className="size-4 text-(--foreground-muted)" />
								)}
							</button>
						))}
					</div>
				)}

				<div className="mt-2 flex justify-end border-(--border) border-t pt-2">
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="btn btn-secondary btn-sm gap-1.5"
					>
						<X className="size-3.5" />
						Close
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
