import {
	listsControllerDeleteListMutation,
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListQueryKey,
	listsControllerGetPublicUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	listsControllerReorderListItemsMutation,
	listsControllerUpdateListMutation,
	type MediaInListDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Check,
	ChevronLeft,
	Film,
	GripVertical,
	List,
	ListOrdered,
	Loader2,
	Pencil,
	Plus,
	Search,
	Trash2,
	Tv,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import AddListItemsDialog from "#/components/AddListItemsDialog";
import { PosterGridSkeleton } from "#/components/skeletons";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";
import { formatRelativeTime } from "#/lib/date-utils";
import { ShowProgressScope } from "#/lib/hooks";
import { cn } from "#/lib/utils";
import ActionableMediaCard from "../../components/ActionableMediaCard";

type SortOption = "position" | "added" | "title" | "year";

const LIST_ITEMS_GRID =
	"grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";

const SORT_LABELS: Record<SortOption, string> = {
	position: "Order",
	added: "Added",
	title: "Title",
	year: "Year",
};

type FilterOption = "all" | "movie" | "show" | "unwatched";

const FILTER_LABELS: Record<FilterOption, string> = {
	all: "All",
	movie: "Movies",
	show: "Shows",
	unwatched: "Unwatched",
};

function moveItem<T>(arr: T[], from: number, to: number): T[] {
	if (to < 0 || to >= arr.length || from === to) return arr;
	const next = arr.slice();
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}

function formatDuration(minutes?: number): string | undefined {
	if (!minutes) return undefined;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function getPosterUrl(media: Record<string, unknown>): string {
	if (media.poster_path && typeof media.poster_path === "string") {
		return `https://image.tmdb.org/t/p/w500${media.poster_path}`;
	}
	if (media.posterPath && typeof media.posterPath === "string") {
		return `https://image.tmdb.org/t/p/w500${media.posterPath}`;
	}
	return "";
}

function getBackdropUrl(media: Record<string, unknown>): string | undefined {
	if (media.backdrop_path && typeof media.backdrop_path === "string") {
		return `https://image.tmdb.org/t/p/original${media.backdrop_path}`;
	}
	if (media.backdropPath && typeof media.backdropPath === "string") {
		return `https://image.tmdb.org/t/p/original${media.backdropPath}`;
	}
	return undefined;
}

function getTitle(media: Record<string, unknown>): string {
	if (media.title && typeof media.title === "string") return media.title;
	if (media.name && typeof media.name === "string") return media.name;
	return "Unknown";
}

function getRating(media: Record<string, unknown>): number | undefined {
	if (media.vote_average && typeof media.vote_average === "number") {
		return media.vote_average;
	}
	if (media.voteAverage && typeof media.voteAverage === "number") {
		return media.voteAverage;
	}
	return undefined;
}

/**
 * Stands in for the toolbar and the poster grid at their real sizes, so the
 * page does not jump when the list arrives. The toolbar block matches the
 * sticky bar's height and border; the grid reuses the page's own columns.
 *
 * Mounted as the route's `pendingComponent` as well as this page's own loading
 * branch: the loader awaits the list, so without that the router would sit on
 * the previous page instead of showing anything.
 */
export function ListDetailSkeleton() {
	const pulse = "animate-pulse rounded bg-(--background-subtle)";
	return (
		<div className="space-y-5">
			{/* Same running order as the real page — back link, toolbar,
			    description, controls, grid — so nothing below shifts when the list
			    lands. A list with no description costs one line of drift; leaving
			    the line out costs it for every list that has one. */}
			<div className={cn("h-5 w-20", pulse)} />
			<div className="space-y-6">
				<div className="-mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-(--border) border-b py-3">
					<div className={cn("h-7 w-40", pulse)} />
					<div className={cn("h-3 w-32", pulse)} />
					<div className={cn("h-3 w-36", pulse)} />
				</div>
				<div className={cn("h-5 w-2/5", pulse)} />
				<div className="space-y-3">
					<div className={cn("h-10 w-full", pulse)} />
					<div className="flex gap-2">
						<div className={cn("h-8 w-20 rounded-full", pulse)} />
						<div className={cn("ml-auto h-8 w-24 rounded-full", pulse)} />
					</div>
					<div className="flex flex-wrap gap-2">
						{["all", "movies", "shows", "unwatched"].map((key) => (
							<div key={key} className={cn("h-8 w-20 rounded-full", pulse)} />
						))}
					</div>
				</div>
				<PosterGridSkeleton gridClassName={LIST_ITEMS_GRID} />
			</div>
		</div>
	);
}

interface ProfileListsPageProps {
	userDid: string;
	handle: string;
	/** Always present: this page is only mounted by the `$listSlug` route. */
	selectedListSlug: string;
	isOwner: boolean;
}

export function ProfileListsPage({
	userDid,
	handle,
	selectedListSlug,
	isOwner,
}: ProfileListsPageProps) {
	const { isAuthenticated } = useAuth();

	const [searchQuery, setSearchQuery] = useState("");
	const [sort, setSort] = useState<SortOption>("position");
	const [filter, setFilter] = useState<FilterOption>("all");
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [editName, setEditName] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [reorderMode, setReorderMode] = useState(false);
	const [reorderItems, setReorderItems] = useState<MediaInListDto[]>([]);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);

	// Fetch selected list details with items using public endpoint
	const {
		data: listDetails,
		isLoading: listLoading,
		error: listError,
	} = useQuery({
		...listsControllerGetPublicUserListOptions({
			path: { userDid, slug: selectedListSlug },
			query: { sort },
		}),
		enabled: !!userDid,
	});

	// Create list mutation (only works for owner)
	const queryClient = useQueryClient();

	// Remove item from list mutation (only works for owner)
	const removeItemMutation = useMutation({
		mutationKey: ["lists", selectedListSlug ?? "", "removeItem"],
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: (_data, variables) => {
			posthog.capture("list_item_changed", {
				action: "removed",
				media_type: variables.path.mediaType,
				list_kind: "custom",
			});
			toast.success("Removed from list");
			if (selectedListSlug) {
				queryClient.invalidateQueries({
					queryKey: listsControllerGetPublicUserListQueryKey({
						path: { userDid, slug: selectedListSlug },
					}),
				});
			}
			queryClient.invalidateQueries({
				queryKey: listsControllerGetPublicUserListsQueryKey({
					path: { userDid },
				}),
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove from list",
			);
		},
	});

	const navigate = useNavigate();

	// Rename / re-describe the list. Renaming regenerates the slug server-side,
	// so the URL we are on goes stale and we have to follow the new one or the
	// next refetch 404s.
	const updateListMutation = useMutation({
		...listsControllerUpdateListMutation(),
		onSuccess: (updated) => {
			toast.success("List updated");
			setShowEditDialog(false);
			queryClient.invalidateQueries({
				queryKey: listsControllerGetPublicUserListsQueryKey({
					path: { userDid },
				}),
			});
			if (updated.slug !== selectedListSlug) {
				navigate({
					to: "/profile/$handle/lists/$listSlug",
					params: { handle, listSlug: updated.slug },
					replace: true,
				});
				return;
			}
			queryClient.invalidateQueries({
				queryKey: listsControllerGetPublicUserListQueryKey({
					path: { userDid, slug: selectedListSlug },
				}),
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update list",
			);
		},
	});

	// Deleting a list: Mobile has had this, Web has not. Owner-only, and never
	// offered for default lists — same gating as Edit.
	const deleteListMutation = useMutation({
		...listsControllerDeleteListMutation(),
		onSuccess: () => {
			toast.success("List deleted");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetPublicUserListsQueryKey({
					path: { userDid },
				}),
			});
			navigate({ to: "/profile/$handle/lists", params: { handle } });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete list",
			);
		},
	});

	const confirmDeleteList = () => {
		if (
			!window.confirm(
				`Delete "${listDetails?.name ?? "this list"}"? This can't be undone.`,
			)
		) {
			return;
		}
		deleteListMutation.mutate({ path: { slug: selectedListSlug } });
	};

	const openEditDialog = () => {
		setEditName(listDetails?.name ?? "");
		setEditDescription(listDetails?.description ?? "");
		setShowEditDialog(true);
	};

	// Reorder items mutation (owner only, position order only)
	const reorderMutation = useMutation({
		mutationKey: ["lists", selectedListSlug ?? "", "reorder"],
		...listsControllerReorderListItemsMutation(),
		onSuccess: () => {
			toast.success("Order saved");
			setReorderMode(false);
			if (selectedListSlug) {
				queryClient.invalidateQueries({
					queryKey: listsControllerGetPublicUserListQueryKey({
						path: { userDid, slug: selectedListSlug },
					}),
				});
			}
			queryClient.invalidateQueries({
				queryKey: listsControllerGetPublicUserListsQueryKey({
					path: { userDid },
				}),
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to save order",
			);
		},
	});

	// Reset per-list view controls when switching lists.
	// biome-ignore lint/correctness/useExhaustiveDependencies: slug is the trigger, not read inside
	useEffect(() => {
		setSearchQuery("");
		setFilter("all");
		setReorderMode(false);
	}, [selectedListSlug]);

	// Reorder is only meaningful in manual (position) order — leaving it aborts.
	useEffect(() => {
		if (sort !== "position") setReorderMode(false);
	}, [sort]);

	// Filter items based on search query + media/unwatched filter
	const filteredItems = useMemo(() => {
		if (!listDetails?.items) return [];
		const query = searchQuery.trim().toLowerCase();
		return listDetails.items.filter((item: MediaInListDto) => {
			if (filter === "movie" && item.mediaType !== "movie") return false;
			if (filter === "show" && item.mediaType === "movie") return false;
			if (filter === "unwatched" && item.watched) return false;
			if (query && !getTitle(item.media).toLowerCase().includes(query)) {
				return false;
			}
			return true;
		});
	}, [listDetails?.items, searchQuery, filter]);

	// Dedupe defensively — reorder ids must be unique.
	const dedupedItems = useMemo(() => {
		const items = listDetails?.items ?? [];
		return items.filter(
			(item, index, self) => index === self.findIndex((i) => i.id === item.id),
		);
	}, [listDetails?.items]);

	const total = listDetails?.total ?? 0;
	const watchedCount = listDetails?.watchedCount ?? 0;

	const enterReorderMode = () => {
		setSearchQuery("");
		setFilter("all");
		setReorderItems(dedupedItems);
		setReorderMode(true);
	};

	const cancelReorder = () => {
		const isDirty =
			reorderItems.map((i) => i.id).join() !==
			dedupedItems.map((i) => i.id).join();
		if (
			isDirty &&
			!window.confirm("Discard changes? Your new order won't be saved.")
		) {
			return;
		}
		setReorderMode(false);
		setDragIndex(null);
	};

	const moveReorderItem = (from: number, to: number) => {
		setReorderItems((prev) => moveItem(prev, from, to));
	};

	const handleDrop = (targetIndex: number) => {
		if (dragIndex === null) return;
		moveReorderItem(dragIndex, targetIndex);
		setDragIndex(null);
		setDropIndex(null);
	};

	const saveReorder = () => {
		if (!selectedListSlug) return;
		reorderMutation.mutate({
			path: { slug: selectedListSlug },
			body: { ids: reorderItems.map((item) => item.id) },
		});
	};

	return (
		<div className="space-y-5">
			<Link
				to="/profile/$handle/lists"
				params={{ handle }}
				className="inline-flex items-center gap-1.5 text-(--foreground-muted) text-sm hover:text-(--foreground)"
			>
				<ChevronLeft className="size-4" />
				All lists
			</Link>

			<div>
				<div>
					{listDetails ? (
						<div className="space-y-6">
							{/* Everything the old info card carried lives in this one bar:
							    name, completion, provenance and the actions. It sticks under
							    the app header so the posters stay reachable while scrolling.
							    `top-16` clears that header. */}
							<div className="sticky top-16 z-10 -mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-(--border) border-b bg-(--background)/95 py-3 backdrop-blur">
								<h2 className="font-semibold text-xl">{listDetails.name}</h2>

								{/* Progress is viewer-relative, so it is absent when signed
								    out; the item count stands in for it. */}
								{isAuthenticated && total > 0 ? (
									<span className="flex items-center gap-2">
										<span
											className="h-1 w-24 overflow-hidden rounded-full bg-(--background-subtle)"
											role="progressbar"
											aria-label="List progress"
											aria-valuemin={0}
											aria-valuemax={total}
											aria-valuenow={watchedCount}
										>
											<span
												className="block h-full rounded-full bg-(--accent) transition-all"
												style={{
													width: `${Math.min(100, (watchedCount / total) * 100)}%`,
												}}
											/>
										</span>
										<span className="text-(--foreground-muted) text-xs tabular-nums">
											{watchedCount}/{total} watched
										</span>
									</span>
								) : (
									<span className="text-(--foreground-muted) text-xs">
										{total} item{total === 1 ? "" : "s"}
									</span>
								)}

								<span className="text-(--foreground-subtle) text-xs">
									{!isOwner && `Created by @${handle} · `}
									Updated {formatRelativeTime(listDetails.updatedAt)}
								</span>

								<span className="ml-auto">
									{reorderMode ? (
										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={cancelReorder}
												disabled={reorderMutation.isPending}
												className="btn btn-secondary btn-sm gap-1.5 rounded-full!"
											>
												<X className="size-3.5" />
												Cancel
											</button>
											<button
												type="button"
												onClick={saveReorder}
												disabled={reorderMutation.isPending}
												className="btn btn-primary btn-sm gap-1.5 rounded-full!"
											>
												{reorderMutation.isPending ? (
													<Loader2 className="size-3.5 animate-spin" />
												) : (
													<Check className="size-3.5" />
												)}
												Done
											</button>
										</div>
									) : (
										isOwner &&
										isAuthenticated && (
											<span className="flex items-center gap-2">
												{/* Default lists are named by the product, so only
												    custom ones can be renamed — matching Mobile. */}
												{!listDetails.isDefault && (
													<button
														type="button"
														onClick={openEditDialog}
														className="btn btn-secondary btn-sm gap-1.5 rounded-full!"
													>
														<Pencil className="size-3.5" />
														Edit
													</button>
												)}
												<button
													type="button"
													onClick={() => setShowAddDialog(true)}
													className="btn btn-primary btn-sm gap-1.5 rounded-full!"
												>
													<Plus className="size-3.5" />
													Add items
												</button>
											</span>
										)
									)}
								</span>
							</div>

							{listDetails.description && (
								<p className="text-(--foreground-muted) text-sm">
									{listDetails.description}
								</p>
							)}

							{!reorderMode && (
								<div className="space-y-3">
									{/* Search — full width, like the mobile field */}
									<div className="relative">
										<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--foreground-muted)" />
										<input
											type="text"
											placeholder="Search list..."
											className="input h-10 w-full pl-9! text-sm"
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
										/>
									</div>

									{/* Sort + Reorder row, matching mobile layout */}
									<div className="flex items-center justify-between gap-2">
										{/* Sort */}
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
													onValueChange={(value) =>
														setSort(value as SortOption)
													}
												>
													{(Object.keys(SORT_LABELS) as SortOption[]).map(
														(option) => (
															<DropdownMenuRadioItem
																key={option}
																value={option}
															>
																{SORT_LABELS[option]}
															</DropdownMenuRadioItem>
														),
													)}
												</DropdownMenuRadioGroup>
											</DropdownMenuContent>
										</DropdownMenu>

										{/* Reorder. Owner-gated: reordering is an owner-only
										    mutation, and before this the control was offered to
										    every visitor and only failed at save. */}
										{!isOwner || !isAuthenticated ? null : sort ===
											"position" ? (
											<button
												type="button"
												onClick={enterReorderMode}
												className="inline-flex items-center gap-1.5 rounded-full bg-(--background-subtle) px-3 py-1.5 font-medium text-(--foreground-muted) text-sm transition-colors hover:text-(--foreground)"
											>
												<ListOrdered className="size-3.5" />
												Reorder
											</button>
										) : (
											<Tooltip>
												<TooltipTrigger asChild>
													<button
														type="button"
														aria-disabled
														onClick={(e) => e.preventDefault()}
														className="inline-flex items-center gap-1.5 rounded-full bg-(--background-subtle) px-3 py-1.5 font-medium text-(--foreground-muted) text-sm opacity-50"
													>
														<ListOrdered className="size-3.5" />
														Reorder
													</button>
												</TooltipTrigger>
												<TooltipContent>
													Switch sort to Order to reorder items
												</TooltipContent>
											</Tooltip>
										)}
									</div>

									{/* Filter pills */}
									<div className="flex flex-wrap items-center gap-2">
										{(Object.keys(FILTER_LABELS) as FilterOption[]).map(
											(option) => (
												<button
													key={option}
													type="button"
													onClick={() => setFilter(option)}
													className={cn(
														"rounded-full px-3 py-1.5 font-medium text-sm transition-colors",
														filter === option
															? "bg-(--accent) text-(--accent-foreground)"
															: "bg-(--background-subtle) text-(--foreground-muted) hover:text-(--foreground)",
													)}
												>
													{FILTER_LABELS[option]}
												</button>
											),
										)}
									</div>
								</div>
							)}

							{/* Error State for List Items */}
							{listError && !listLoading && (
								<div className="flex h-64 flex-col items-center justify-center gap-4">
									<AlertCircle className="size-12 text-red-500" />
									<div className="text-center">
										<h3 className="font-semibold text-(--foreground)">
											Failed to load list items
										</h3>
										<p className="text-(--foreground-muted) text-sm">
											{listError instanceof Error
												? listError.message
												: "An error occurred"}
										</p>
									</div>
									<Button
										onClick={() => window.location.reload()}
										variant="outline"
									>
										Retry
									</Button>
								</div>
							)}

							{/* Reorder Mode — vertical list with drag handles + up/down
							    buttons so it works with both mouse and keyboard. */}
							{reorderMode && !listLoading && !listError && (
								<div className="space-y-3">
									{/* Copy toggles by pointer type: HTML5 drag never fires from
									    touch, so coarse pointers only get the arrow-button path. */}
									<p className="text-(--foreground-muted) text-xs">
										<span className="[@media(pointer:fine)]:hidden">
											Use the arrow buttons to reorder, then press Done to save.
										</span>
										<span className="hidden [@media(pointer:fine)]:inline">
											Drag a poster onto the position you want, or use the arrow
											buttons, then press Done to save.
										</span>
									</p>

									{/* Same grid as the real list, so entering reorder rearranges
									    nothing — the posters stay exactly where they were. */}
									{/* biome-ignore lint/a11y/noStaticElementInteractions: clears the drop hint when the pointer leaves the grid */}
									<div
										className={`grid ${LIST_ITEMS_GRID}`}
										onDragLeave={(e) => {
											if (!e.currentTarget.contains(e.relatedTarget as Node)) {
												setDropIndex(null);
											}
										}}
									>
										{reorderItems.map((item, index) => (
											// biome-ignore lint/a11y/noStaticElementInteractions: drag handlers; keyboard reorder is provided via the arrow buttons
											<div
												key={item.id}
												draggable
												onDragStart={() => setDragIndex(index)}
												onDragOver={(e) => {
													e.preventDefault();
													if (dropIndex !== index) setDropIndex(index);
												}}
												onDrop={() => handleDrop(index)}
												onDragEnd={() => {
													setDragIndex(null);
													setDropIndex(null);
												}}
												className={cn(
													// Not clipped: the drop line sits in the grid
													// gutter, outside the card's own box.
													"group relative cursor-grab rounded-lg border-2 transition-all active:cursor-grabbing",
													dragIndex === index
														? "border-(--accent) opacity-40"
														: "border-transparent",
												)}
											>
												{/* Where the poster will land. `moveItem` splices the
												    dragged item out and back in at the target, so
												    dragging forward drops it after that card and
												    backward drops it before — hence the side flip. */}
												{dragIndex !== null &&
													dropIndex === index &&
													dragIndex !== index && (
														<span
															aria-hidden="true"
															className={cn(
																"absolute inset-y-0 z-10 w-1 rounded-full bg-(--accent)",
																// Centred in the grid gutter, not flush against
																// a card. Offsets are measured from the padding
																// box, so each is half the gap, plus half the
																// line, plus the 2px border: 8px gutter -> 8,
																// 16px gutter -> 12.
																dragIndex < index
																	? "-right-2 sm:-right-3"
																	: "-left-2 sm:-left-3",
															)}
														/>
													)}
												<div className="relative aspect-[2/3] overflow-hidden rounded-md bg-(--background-subtle)">
													{getPosterUrl(item.media) ? (
														<img
															src={getPosterUrl(item.media)}
															alt={getTitle(item.media)}
															className="size-full object-cover"
															loading="lazy"
															draggable={false}
														/>
													) : (
														<div className="flex size-full items-center justify-center text-(--foreground-subtle)">
															{item.mediaType === "movie" ? (
																<Film className="size-6" />
															) : (
																<Tv className="size-6" />
															)}
														</div>
													)}

													{/* Position is the whole point of this mode, so it
													    stays visible rather than appearing on hover. */}
													<span className="absolute top-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 font-medium text-[11px] text-white tabular-nums">
														{index + 1}/{reorderItems.length}
													</span>

													<GripVertical className="absolute top-1.5 right-1.5 hidden size-4 text-white/80 drop-shadow [@media(pointer:fine)]:block" />

													{/* The only reorder path on touch, and the keyboard
													    path everywhere. Always rendered, not hover-gated. */}
													<div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
														<button
															type="button"
															aria-label={`Move ${getTitle(item.media)} earlier`}
															disabled={index === 0}
															onClick={() => moveReorderItem(index, index - 1)}
															className="flex size-7 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-30"
														>
															<ArrowUp className="size-3.5 -rotate-90" />
														</button>
														<button
															type="button"
															aria-label={`Move ${getTitle(item.media)} later`}
															disabled={index === reorderItems.length - 1}
															onClick={() => moveReorderItem(index, index + 1)}
															className="flex size-7 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-30"
														>
															<ArrowDown className="size-3.5 -rotate-90" />
														</button>
													</div>
												</div>
												<p className="truncate px-1 pt-1.5 text-xs">
													{getTitle(item.media)}
												</p>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Empty State */}
							{!reorderMode &&
								!listLoading &&
								!listError &&
								filteredItems.length === 0 && (
									<div className="flex h-64 flex-col items-center justify-center rounded-xl border-(--border) border-2 border-dashed">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--background-subtle)">
											<List className="size-6 text-(--foreground-subtle)" />
										</div>
										<h3 className="mt-3 font-display font-semibold">
											{searchQuery || filter !== "all"
												? "No results found"
												: "List is empty"}
										</h3>
										<p className="mt-1 text-(--foreground-muted) text-sm">
											{searchQuery || filter !== "all"
												? "Try adjusting your filters"
												: "Add movies and shows to this list to see them here"}
										</p>
									</div>
								)}

							{/* Items Grid/List */}
							{!reorderMode &&
								!listLoading &&
								!listError &&
								filteredItems.length > 0 && (
									<ShowProgressScope
										showIds={filteredItems
											.filter(
												(item) =>
													item.mediaType === "show" &&
													item.seasonNumber === undefined &&
													item.episodeNumber === undefined,
											)
											.map((item) => String(item.mediaId))}
									>
										<div className={`grid ${LIST_ITEMS_GRID}`}>
											{filteredItems
												.filter(
													(item, index, self) =>
														index === self.findIndex((i) => i.id === item.id),
												)
												.map((item: MediaInListDto) => (
													<ActionableMediaCard
														key={item.id}
														fill
														id={String(
															(item.media as Record<string, unknown>).mediaId ??
																item.mediaId,
														)}
														title={getTitle(item.media)}
														seasonNumber={item.seasonNumber}
														episodeNumber={item.episodeNumber}
														episodeInfo={
															item.seasonNumber !== undefined &&
															item.episodeNumber !== undefined
																? item.episodeName
																	? `S${item.seasonNumber}E${item.episodeNumber} — ${item.episodeName}`
																	: `S${item.seasonNumber}E${item.episodeNumber}`
																: item.seasonNumber !== undefined
																	? `Season ${item.seasonNumber}`
																	: undefined
														}
														posterUrl={getPosterUrl(item.media)}
														backdropUrl={getBackdropUrl(item.media)}
														type={item.mediaType === "movie" ? "movie" : "show"}
														tmdbRating={getRating(item.media)}
														duration={formatDuration(
															item.media.runtime as number | undefined,
														)}
														onRemove={
															isOwner
																? () =>
																		removeItemMutation.mutate({
																			path: {
																				slug: selectedListSlug,
																				mediaType: item.mediaType,
																				mediaId: item.mediaId,
																			},
																			query: {
																				seasonNumber: item.seasonNumber,
																				episodeNumber: item.episodeNumber,
																			},
																		})
																: undefined
														}
														isRemoving={
															isOwner &&
															removeItemMutation.isPending &&
															removeItemMutation.variables?.path?.mediaId ===
																item.mediaId
														}
														watchCount={item.watchCount}
													/>
												))}
										</div>
									</ShowProgressScope>
								)}
						</div>
					) : listLoading ? (
						<ListDetailSkeleton />
					) : (
						<div className="flex h-96 flex-col items-center justify-center rounded-xl border-(--border) border-2 border-dashed">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-(--background-subtle)">
								<List className="size-8 text-(--foreground-subtle)" />
							</div>
							<h3 className="mt-4 font-display font-semibold text-lg">
								List not found
							</h3>
							<p className="mt-1 text-(--foreground-muted)">
								This list doesn't exist, or it isn't public.
							</p>
						</div>
					)}
				</div>
			</div>

			{isOwner && (
				<Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
					<DialogContent className="sm:max-w-[425px]">
						<DialogHeader>
							<DialogTitle>Edit List</DialogTitle>
							<DialogDescription>
								Rename this list or change its description.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<label htmlFor="edit-list-name" className="font-medium text-sm">
									List Name
								</label>
								<input
									id="edit-list-name"
									type="text"
									className="input"
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<label
									htmlFor="edit-list-description"
									className="font-medium text-sm"
								>
									Description (optional)
								</label>
								<textarea
									id="edit-list-description"
									placeholder="What's this list about?"
									className="input min-h-[80px] resize-none"
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
								/>
							</div>
						</div>
						<div className="flex items-center justify-between gap-2">
							{/* Destructive action sits apart from Save so the two are not
							    adjacent targets. */}
							<Button
								variant="outline"
								onClick={confirmDeleteList}
								disabled={deleteListMutation.isPending}
								className="gap-1.5 text-red-600 hover:text-red-600"
							>
								<Trash2 className="size-4" />
								{deleteListMutation.isPending ? "Deleting..." : "Delete"}
							</Button>

							<span className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => setShowEditDialog(false)}
								>
									Cancel
								</Button>
								<Button
									onClick={() =>
										updateListMutation.mutate({
											path: { slug: selectedListSlug },
											body: {
												name: editName.trim(),
												description: editDescription.trim() || undefined,
											},
										})
									}
									disabled={!editName.trim() || updateListMutation.isPending}
								>
									{updateListMutation.isPending ? (
										<>
											<Loader2
												data-icon="inline-start"
												className="animate-spin"
											/>
											Saving...
										</>
									) : (
										"Save changes"
									)}
								</Button>
							</span>
						</div>
					</DialogContent>
				</Dialog>
			)}

			{/* Add Items Dialog */}
			{isOwner && selectedListSlug && (
				<AddListItemsDialog
					open={showAddDialog}
					onOpenChange={setShowAddDialog}
					userDid={userDid}
					slug={selectedListSlug}
					existingItems={listDetails?.items ?? []}
				/>
			)}
		</div>
	);
}
