import { Check, Loader2, Plus, X } from "lucide-react";
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
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title?: string;
	description?: string;
}

export default function ManageListsDialog({
	mediaType,
	mediaId,
	open,
	onOpenChange,
	title = "Manage lists",
	description = "Add or remove this item from your lists",
}: ManageListsDialogProps) {
	const { customListsWithStatus, userLists, listsForItem } = useListItemStatus({
		mediaType,
		mediaId,
	});

	const {
		addToList,
		removeFromList,
		toggleWatchlist,
		toggleFavorites,
		isPending,
	} = useListActions({ mediaType, mediaId });

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
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
					</div>
				) : (
					<div className="space-y-1 py-2">
						{/* Watchlist */}
						<button
							type="button"
							onClick={() => toggleWatchlist(isWatchlist)}
							disabled={isPending}
							className="w-full flex items-center justify-between text-left px-3 py-2.5 text-sm rounded-md hover:bg-[var(--background-subtle)] transition-colors"
						>
							<span>Watchlist</span>
							{isWatchlist ? (
								<Check className="h-4 w-4 text-green-500" />
							) : (
								<Plus className="h-4 w-4 text-[var(--foreground-muted)]" />
							)}
						</button>

						{/* Favorites */}
						<button
							type="button"
							onClick={() => toggleFavorites(isFavorites)}
							disabled={isPending}
							className="w-full flex items-center justify-between text-left px-3 py-2.5 text-sm rounded-md hover:bg-[var(--background-subtle)] transition-colors"
						>
							<span>Favorites</span>
							{isFavorites ? (
								<Check className="h-4 w-4 text-green-500" />
							) : (
								<Plus className="h-4 w-4 text-[var(--foreground-muted)]" />
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
								className="w-full flex items-center justify-between text-left px-3 py-2.5 text-sm rounded-md hover:bg-[var(--background-subtle)] transition-colors"
							>
								<span>{list.name}</span>
								{list.isInList ? (
									<Check className="h-4 w-4 text-green-500" />
								) : (
									<Plus className="h-4 w-4 text-[var(--foreground-muted)]" />
								)}
							</button>
						))}
					</div>
				)}

				<div className="flex justify-end pt-2 border-t border-[var(--border)] mt-2">
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="btn btn-secondary btn-sm gap-1.5"
					>
						<X className="h-3.5 w-3.5" />
						Close
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
