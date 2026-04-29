import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import ManageListsDialog from "#/components/ManageListsDialog";
import { useAuth } from "#/lib/auth-context";
import { useListActions, useListItemStatus } from "#/lib/hooks";

interface InYourListsProps {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export default function InYourLists({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: InYourListsProps) {
	const [open, setOpen] = useState(false);
	const { user } = useAuth();
	const userHandle = user?.handle;
	const { otherLists, availableLists } = useListItemStatus({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const { removeFromList, isPending } = useListActions({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	return (
		<section className="card relative p-5">
			<h3 className="mb-4 font-display font-semibold">In Your Lists</h3>
			<div className="space-y-2">
				{otherLists.length > 0 ? (
					otherLists.map((list) => (
						<div
							key={list.listSlug}
							className="group flex items-center rounded-lg transition-colors hover:bg-(--background-subtle)"
						>
							<Link
								to="/profile/$handle/lists/$listSlug"
								params={{
									handle: userHandle || "",
									listSlug: list.listSlug,
								}}
								className="flex flex-1 items-center p-2"
							>
								<span className="font-medium text-sm">{list.listName}</span>
							</Link>
							<button
								type="button"
								onClick={() => removeFromList(list.listSlug)}
								disabled={isPending}
								className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-red-500/10 hover:text-red-500"
								aria-label={`Remove from ${list.listName}`}
							>
								<X className="h-4 w-4" />
							</button>
							<Link
								to="/profile/$handle/lists/$listSlug"
								params={{
									handle: userHandle || "",
									listSlug: list.listSlug,
								}}
								className="flex items-center p-2"
							>
								<ChevronRight className="h-4 w-4 text-(--foreground-muted)" />
							</Link>
						</div>
					))
				) : availableLists.length === 0 ? (
					<div className="space-y-3">
						<p className="text-(--foreground-muted) text-sm">
							Not in any lists yet
						</p>
						{userHandle && (
							<Link
								to="/profile/$handle/lists"
								params={{ handle: userHandle }}
								className="btn btn-secondary w-full gap-2 text-sm"
							>
								<Plus className="h-4 w-4" />
								Create your first list
							</Link>
						)}
					</div>
				) : (
					<p className="text-(--foreground-muted) text-sm">
						Not in any lists yet
					</p>
				)}
			</div>
			{(availableLists.length > 0 || otherLists.length > 0) && (
				<>
					<button
						type="button"
						onClick={() => setOpen(true)}
						className="btn btn-secondary mt-3 w-full text-sm"
					>
						<Plus className="h-4 w-4" />
						Add to list
					</button>

					<ManageListsDialog
						mediaType={mediaType}
						mediaId={mediaId}
						seasonNumber={seasonNumber}
						episodeNumber={episodeNumber}
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
