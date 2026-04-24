import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import ManageListsDialog from "#/components/ManageListsDialog";
import { useListActions, useListItemStatus } from "#/lib/hooks";

interface InYourListsProps {
	mediaType: "movie" | "show";
	mediaId: string;
}

export default function InYourLists({ mediaType, mediaId }: InYourListsProps) {
	const [open, setOpen] = useState(false);
	const { otherLists, availableLists } = useListItemStatus({
		mediaType,
		mediaId,
	});
	const { removeFromList, isPending } = useListActions({
		mediaType,
		mediaId,
	});

	return (
		<section className="card p-5 relative">
			<h3 className="font-display font-semibold mb-4">In Your Lists</h3>
			<div className="space-y-2">
				{otherLists.length > 0 ? (
					otherLists.map((list) => (
						<div
							key={list.listSlug}
							className="group flex items-center rounded-lg transition-colors hover:bg-[var(--background-subtle)]"
						>
							<Link
								to="/lists/$listSlug"
								params={{ listSlug: list.listSlug }}
								className="flex flex-1 items-center p-2"
							>
								<span className="text-sm font-medium">{list.listName}</span>
							</Link>
							<button
								type="button"
								onClick={() => removeFromList(list.listSlug)}
								disabled={isPending}
								className="flex items-center justify-center h-8 w-8 rounded-md text-[var(--foreground-muted)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
								aria-label={`Remove from ${list.listName}`}
							>
								<X className="h-4 w-4" />
							</button>
							<Link
								to="/lists/$listSlug"
								params={{ listSlug: list.listSlug }}
								className="flex items-center p-2"
							>
								<ChevronRight className="h-4 w-4 text-[var(--foreground-muted)]" />
							</Link>
						</div>
					))
				) : availableLists.length === 0 ? (
					<div className="space-y-3">
						<p className="text-sm text-[var(--foreground-muted)]">
							Not in any lists yet
						</p>
						<Link
							to="/lists"
							className="btn btn-secondary w-full text-sm gap-2"
						>
							<Plus className="h-4 w-4" />
							Create your first list
						</Link>
					</div>
				) : (
					<p className="text-sm text-[var(--foreground-muted)]">
						Not in any lists yet
					</p>
				)}
			</div>
			{(availableLists.length > 0 || otherLists.length > 0) && (
				<>
					<button
						type="button"
						onClick={() => setOpen(true)}
						className="mt-3 w-full btn btn-secondary text-sm"
					>
						<Plus className="h-4 w-4" />
						Add to list
					</button>

					<ManageListsDialog
						mediaType={mediaType}
						mediaId={mediaId}
						open={open}
						onOpenChange={setOpen}
						title="Add to list"
						description="Choose a list to add this item to"
					/>
				</>
			)}
		</section>
	);
}
