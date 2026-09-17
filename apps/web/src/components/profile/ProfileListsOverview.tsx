import {
	type ListSummaryDto,
	listsControllerGetPublicUserListsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowUpDown,
	Clock,
	Film,
	Heart,
	List,
	Loader2,
	type LucideIcon,
	Plus,
	Star,
	Tv,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { formatRelativeTime } from "#/lib/date-utils";
import { useCreateList } from "#/lib/hooks";
import { cn } from "#/lib/utils";

type SortOption = "default" | "updated" | "name" | "items";

/**
 * "Default" is the server's own order — default lists first, then by name —
 * so it stays the thing you see until you ask for something else. The rest are
 * client-side: the whole list set is already loaded, so sorting it needs no
 * round trip and no new query key.
 */
const SORT_LABELS: Record<SortOption, string> = {
	default: "Default order",
	updated: "Recently updated",
	name: "Name",
	items: "Most items",
};

function sortLists(
	lists: ListSummaryDto[],
	sort: SortOption,
): ListSummaryDto[] {
	if (sort === "default") return lists;
	const sorted = [...lists];
	if (sort === "updated") {
		sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	} else if (sort === "name") {
		sorted.sort((a, b) => a.name.localeCompare(b.name));
	} else {
		// Ties keep a stable, readable order rather than whatever the API sent.
		sorted.sort(
			(a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name),
		);
	}
	return sorted;
}

/** Cards and their skeleton share this, so the placeholder lands on the real shape. */
const OVERVIEW_GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
const COVER_BAND = "relative h-32 bg-(--background-subtle)";
/** Width the poster occupies, plus its gutter — the text column starts here. */
const COVER_INSET = "pl-[7.5rem]";

const COLOR_BG: Record<string, string> = {
	blue: "bg-blue-500",
	red: "bg-red-500",
	purple: "bg-purple-500",
	green: "bg-green-500",
	yellow: "bg-yellow-500",
	gray: "bg-gray-500",
};

const COLOR_ICON: Record<string, LucideIcon> = {
	blue: Clock,
	red: Heart,
	purple: Star,
	green: Film,
	yellow: Tv,
	gray: List,
};

/** A list with no cover art still needs an identity; its name picks a colour. */
function listColor(name: string): string {
	const n = name.toLowerCase();
	if (n.includes("watch") || n.includes("later")) return "blue";
	if (n.includes("fav") || n.includes("love")) return "red";
	if (n.includes("best") || n.includes("top")) return "purple";
	if (n.includes("sci") || n.includes("action")) return "green";
	if (n.includes("comedy") || n.includes("fun")) return "yellow";
	return "gray";
}

function coverUrl(list: ListSummaryDto): string | undefined {
	return list.coverPosterPath
		? `https://image.tmdb.org/t/p/w500${list.coverPosterPath}`
		: undefined;
}

/**
 * One card per list. The cover is the list's first item in manual order, served
 * on `ListSummaryDto` so this grid costs one request however many lists there
 * are. The poster keeps its 2:3 shape over a blurred fill of itself rather than
 * being cropped into a letterbox, and overhangs into the body so the name reads
 * against the artwork.
 */
function ListCard({ list, handle }: { list: ListSummaryDto; handle: string }) {
	const cover = coverUrl(list);
	const color = listColor(list.name);
	const Icon = COLOR_ICON[color];

	return (
		<Link
			to="/profile/$handle/lists/$listSlug"
			params={{ handle, listSlug: list.slug }}
			className="group block overflow-hidden rounded-2xl border border-(--border) transition-shadow hover:shadow-lg"
		>
			<div className={COVER_BAND}>
				{/* Only the backdrop is clipped; the poster overhangs into the body. */}
				<div className="absolute inset-0 overflow-hidden">
					{cover ? (
						<img
							src={cover}
							alt=""
							aria-hidden="true"
							className="absolute inset-0 size-full scale-110 object-cover blur-xl"
						/>
					) : (
						<div
							className={cn("relative size-full opacity-90", COLOR_BG[color])}
						>
							<Icon className="absolute -right-4 -bottom-6 size-28 text-white/25" />
						</div>
					)}
					{/* Darkened toward the bottom so the name reads on any artwork. */}
					<div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />
				</div>

				{cover && (
					<img
						src={cover}
						alt=""
						aria-hidden="true"
						className="absolute bottom-[-1rem] left-4 h-36 rounded-md shadow-lg ring-1 ring-black/10"
					/>
				)}

				<div
					className={cn(
						"absolute right-4 bottom-3 flex items-center gap-2",
						cover ? "left-[7.5rem]" : "left-4",
					)}
				>
					<h2 className="truncate font-semibold text-white drop-shadow-md">
						{list.name}
					</h2>
					{list.isDefault && (
						<span className="shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
							Default
						</span>
					)}
				</div>
			</div>

			<div className={cn("space-y-1 p-4", cover && COVER_INSET)}>
				<p className="line-clamp-2 min-h-[2.5em] text-(--foreground-muted) text-sm">
					{list.description || "No description"}
				</p>
				<p className="text-(--foreground-subtle) text-xs">
					{list.itemCount} item{list.itemCount === 1 ? "" : "s"} · Updated{" "}
					{formatRelativeTime(list.updatedAt)}
				</p>
			</div>
		</Link>
	);
}

/**
 * Matches ListCard's geometry: same grid, same band height, a poster-shaped
 * block in the same place, and the text column starting at the same inset. A
 * generic row skeleton here would shift everything once the real cards land.
 *
 * Mounted as the route's `pendingComponent` too — the loader awaits the lists,
 * so otherwise the router would hold the previous page rather than show this.
 */
export function ListCardSkeleton({ count = 3 }: { count?: number }) {
	const pulse = "animate-pulse rounded bg-(--background-subtle)";
	return (
		<div className={OVERVIEW_GRID}>
			{Array.from({ length: count }, (_, i) => i).map((i) => (
				<div
					key={i}
					className="overflow-hidden rounded-2xl border border-(--border)"
				>
					<div className={cn(COVER_BAND, "animate-pulse")}>
						{/* Stands where the poster does, overhang included. */}
						<div className="absolute bottom-[-1rem] left-4 h-36 w-24 rounded-md bg-(--border)" />
						<div className="absolute right-4 bottom-3 left-[7.5rem] h-4 w-1/2 rounded bg-(--border)" />
					</div>
					<div className={cn("space-y-2 p-4", COVER_INSET)}>
						<div className={cn("h-3 w-4/5", pulse)} />
						<div className={cn("h-3 w-1/3", pulse)} />
					</div>
				</div>
			))}
		</div>
	);
}

export function ProfileListsOverview({
	userDid,
	handle,
	isOwner,
}: {
	userDid: string;
	handle: string;
	isOwner: boolean;
}) {
	const navigate = useNavigate();
	const createListMutation = useCreateList();
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newListName, setNewListName] = useState("");
	const [newListDescription, setNewListDescription] = useState("");
	const [sort, setSort] = useState<SortOption>("default");

	const {
		data: lists,
		isLoading,
		error,
		refetch: refetchLists,
		isFetching,
	} = useQuery({
		...listsControllerGetPublicUserListsOptions({ path: { userDid } }),
		enabled: !!userDid,
	});

	const sortedLists = useMemo(
		() => (lists ? sortLists(lists, sort) : undefined),
		[lists, sort],
	);

	const handleCreateList = async () => {
		if (!newListName.trim()) return;
		try {
			const newList = await createListMutation.mutateAsync({
				body: {
					name: newListName.trim(),
					description: newListDescription.trim() || undefined,
				},
			});
			setShowCreateModal(false);
			setNewListName("");
			setNewListDescription("");
			navigate({
				to: "/profile/$handle/lists/$listSlug",
				params: { handle, listSlug: newList.slug },
			});
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to create list");
		}
	};

	return (
		<div className="space-y-6">
			{/* Sort sits under the title rather than opposite it: it is a view
			    control, and this mirrors the detail page, which runs Order,
			    Reorder and the filter pills along the left under its header.
			    Creating a list is offered by the card at the end of the grid, so
			    there is no second button competing up here. */}
			<div className="space-y-3">
				<h1 className="text-display-2">Lists</h1>
				{lists && lists.length > 1 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="inline-flex items-center gap-1.5 rounded-full bg-(--background-subtle) px-3 py-1.5 font-medium text-(--foreground-muted) text-sm transition-colors hover:text-(--foreground)"
							>
								<ArrowUpDown className="size-3.5" />
								{SORT_LABELS[sort]}
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuRadioGroup
								value={sort}
								onValueChange={(value) => setSort(value as SortOption)}
							>
								{(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
									<DropdownMenuRadioItem key={option} value={option}>
										{SORT_LABELS[option]}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			{isLoading && <ListCardSkeleton />}

			{/* Only when there is nothing to show. A refetch that fails on top of
			    loaded lists gets the strip below instead, so the reader keeps the
			    lists they already had. */}
			{error && !isLoading && !lists && (
				<div className="flex h-64 flex-col items-center justify-center gap-4">
					<AlertCircle className="size-12 text-red-500" />
					<div className="text-center">
						<h2 className="font-semibold text-(--foreground)">
							Failed to load lists
						</h2>
						<p className="text-(--foreground-muted) text-sm">
							{error instanceof Error ? error.message : "An error occurred"}
						</p>
					</div>
					<Button onClick={() => refetchLists()} variant="outline">
						Retry
					</Button>
				</div>
			)}

			{error && lists && (
				<div className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--background-subtle) px-4 py-2.5">
					<AlertCircle className="size-4 shrink-0 text-red-500" />
					<p className="text-(--foreground-muted) text-sm">
						Couldn't refresh these lists. Showing what loaded last.
					</p>
					<Button
						className="ml-auto"
						disabled={isFetching}
						onClick={() => refetchLists()}
						size="sm"
						variant="ghost"
					>
						{isFetching ? "Retrying…" : "Retry"}
					</Button>
				</div>
			)}

			{lists && lists.length === 0 && (
				<div className="card p-8 text-center">
					<List className="mx-auto mb-3 size-8 text-(--foreground-muted)" />
					<p className="text-(--foreground-muted)">No lists yet.</p>
					{isOwner && (
						<button
							type="button"
							onClick={() => setShowCreateModal(true)}
							className="btn btn-primary mt-4 gap-2 rounded-full!"
						>
							<Plus className="size-4" />
							Create List
						</button>
					)}
				</div>
			)}

			{sortedLists && sortedLists.length > 0 && (
				<div className={OVERVIEW_GRID}>
					{sortedLists.map((list) => (
						<ListCard key={list.id} list={list} handle={handle} />
					))}
					{isOwner && (
						<button
							type="button"
							onClick={() => setShowCreateModal(true)}
							className="flex min-h-[160px] items-center justify-center rounded-2xl border-(--border) border-2 border-dashed text-(--foreground-subtle) text-sm transition-colors hover:border-(--accent) hover:text-(--foreground)"
						>
							<Plus className="mr-1.5 size-4" />
							New list
						</button>
					)}
				</div>
			)}

			{/* Carried over from the master-detail page unchanged: the redesign
			    moves where Create List lives, not how it behaves. */}
			{isOwner && (
				<Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
					<DialogContent className="sm:max-w-[425px]">
						<DialogHeader>
							<DialogTitle>Create New List</DialogTitle>
							<DialogDescription>
								Create a custom list to organize your movies and shows.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<label htmlFor="list-name" className="font-medium text-sm">
									List Name
								</label>
								<input
									id="list-name"
									type="text"
									placeholder="My Awesome List"
									className="input"
									value={newListName}
									onChange={(e) => setNewListName(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<label
									htmlFor="list-description"
									className="font-medium text-sm"
								>
									Description (optional)
								</label>
								<textarea
									id="list-description"
									placeholder="What's this list about?"
									className="input min-h-[80px] resize-none"
									value={newListDescription}
									onChange={(e) => setNewListDescription(e.target.value)}
								/>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setShowCreateModal(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleCreateList}
								disabled={!newListName.trim() || createListMutation.isPending}
							>
								{createListMutation.isPending ? (
									<>
										<Loader2
											data-icon="inline-start"
											className="animate-spin"
										/>
										Creating...
									</>
								) : (
									"Create List"
								)}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
