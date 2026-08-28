import {
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListQueryKey,
	listsControllerGetPublicUserListsOptions,
	listsControllerGetPublicUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	listsControllerReorderListItemsMutation,
	type MediaInListDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Check,
	Clock,
	Film,
	GripVertical,
	Heart,
	List,
	ListOrdered,
	Loader2,
	Plus,
	Search,
	Star,
	Tv,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import AddListItemsDialog from "#/components/AddListItemsDialog";
import { PosterGridSkeleton, RowListSkeleton } from "#/components/skeletons";
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
import { useCreateList } from "#/lib/hooks";
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

const colorClasses: Record<string, string> = {
	blue: "bg-blue-500",
	red: "bg-red-500",
	purple: "bg-purple-500",
	green: "bg-green-500",
	yellow: "bg-yellow-500",
	gray: "bg-gray-500",
};

const iconComponents: Record<
	string,
	React.ComponentType<{ className?: string }>
> = {
	blue: Clock,
	red: Heart,
	purple: Star,
	green: Film,
	yellow: Tv,
	gray: List,
};

function getListColor(name: string): string {
	const nameLower = name.toLowerCase();
	if (nameLower.includes("watch") || nameLower.includes("later")) return "blue";
	if (nameLower.includes("fav") || nameLower.includes("love")) return "red";
	if (nameLower.includes("best") || nameLower.includes("top")) return "purple";
	if (nameLower.includes("sci") || nameLower.includes("action")) return "green";
	if (nameLower.includes("comedy") || nameLower.includes("fun"))
		return "yellow";
	return "gray";
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

interface ProfileListsPageProps {
	userDid: string;
	handle: string;
	selectedListSlug?: string | null;
	isOwner: boolean;
}

export function ProfileListsPage({
	userDid,
	handle,
	selectedListSlug,
	isOwner,
}: ProfileListsPageProps) {
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();

	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newListName, setNewListName] = useState("");
	const [newListDescription, setNewListDescription] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [sort, setSort] = useState<SortOption>("position");
	const [filter, setFilter] = useState<FilterOption>("all");
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [reorderMode, setReorderMode] = useState(false);
	const [reorderItems, setReorderItems] = useState<MediaInListDto[]>([]);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const listContentRef = useRef<HTMLDivElement>(null);

	// Fetch public lists for this user
	const {
		data: userLists,
		isLoading: listsLoading,
		error: listsError,
	} = useQuery({
		...listsControllerGetPublicUserListsOptions({ path: { userDid } }),
		enabled: !!userDid,
	});

	// Default to the first list when lists load and none is selected
	useEffect(() => {
		if (userLists && userLists.length > 0 && !selectedListSlug) {
			navigate({
				to: "/profile/$handle/lists/$listSlug",
				params: { handle, listSlug: userLists[0].slug },
				replace: true,
			});
		}
	}, [navigate, selectedListSlug, userLists, handle]);

	// Fetch selected list details with items using public endpoint
	const {
		data: listDetails,
		isLoading: listLoading,
		error: listError,
	} = useQuery({
		...listsControllerGetPublicUserListOptions({
			path: { userDid, slug: selectedListSlug || "" },
			query: { sort },
		}),
		enabled: !!userDid && !!selectedListSlug,
	});

	// Create list mutation (only works for owner)
	const createListMutation = useCreateList();
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

	const activeList = useMemo(() => {
		if (!userLists) return null;
		return userLists.find((list) => list.slug === selectedListSlug);
	}, [userLists, selectedListSlug]);

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

	const handleSelectList = (slug: string) => {
		navigate({
			to: "/profile/$handle/lists/$listSlug",
			params: { handle, listSlug: slug },
			replace: true,
			// The router's default scroll-to-top lands AFTER the scrollIntoView
			// below, yanking the viewport back up. Same-page selection keeps its
			// own scroll handling.
			resetScroll: false,
		});
		// Below lg the sidebar stacks above the content, so a tap otherwise
		// leaves the user looking at the sidebar. Only scroll in that layout;
		// rAF lets the selected list render before we scroll to it.
		if (window.matchMedia("(max-width: 1023px)").matches) {
			requestAnimationFrame(() => {
				listContentRef.current?.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
			});
		}
	};

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
	};

	const saveReorder = () => {
		if (!selectedListSlug) return;
		reorderMutation.mutate({
			path: { slug: selectedListSlug },
			body: { ids: reorderItems.map((item) => item.id) },
		});
	};

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
			if (newList?.slug) {
				navigate({
					to: "/profile/$handle/lists/$listSlug",
					params: { handle, listSlug: newList.slug },
					replace: true,
				});
			}
		} catch (error) {
			console.error("Failed to create list:", error);
		}
	};

	// Show loading state
	if (listsLoading) {
		return (
			<div className="py-8">
				<RowListSkeleton rows={4} />
			</div>
		);
	}

	// Show error state
	if (listsError) {
		return (
			<div className="py-8">
				<div className="flex h-64 flex-col items-center justify-center gap-4">
					<AlertCircle className="size-12 text-red-500" />
					<div className="text-center">
						<h3 className="font-semibold text-(--foreground)">
							Failed to load lists
						</h3>
						<p className="text-(--foreground-muted) text-sm">
							{listsError instanceof Error
								? listsError.message
								: "An error occurred"}
						</p>
					</div>
					<Button onClick={() => window.location.reload()} variant="outline">
						Retry
					</Button>
				</div>
			</div>
		);
	}

	// Show empty state when user has no lists
	if (userLists && userLists.length === 0) {
		return (
			<div className="py-8">
				<h1 className="text-display-2">Lists</h1>

				<div className="card p-8 text-center">
					<List className="mx-auto mb-3 size-8 text-(--foreground-muted)" />
					<p className="text-(--foreground-muted)">No lists yet.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-display-2">Lists</h1>

				{isOwner && isAuthenticated && (
					<button
						type="button"
						onClick={() => setShowCreateModal(true)}
						className="btn btn-primary gap-2 rounded-full!"
					>
						<Plus className="size-4" />
						Create List
					</button>
				)}
			</div>

			<div className="grid gap-8 lg:grid-cols-4">
				{/* Lists Sidebar */}
				<div className="space-y-3">
					{userLists?.map((list) => {
						const color = getListColor(list.name);
						const Icon = iconComponents[color] || List;
						const isSelected = selectedListSlug === list.slug;
						return (
							<button
								key={list.id}
								type="button"
								onClick={() => handleSelectList(list.slug)}
								className={`card card-interactive w-full p-4 text-left transition-all ${
									isSelected
										? "border-(--accent) border-2 bg-(--accent-subtle) shadow-sm"
										: "hover:border-(--accent)/40"
								}`}
							>
								<div className="flex items-start gap-3">
									<div
										className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorClasses[color]} text-white`}
									>
										<Icon className="h-5 w-5" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<h3 className="truncate font-semibold text-(--foreground)">
												{list.name}
											</h3>
											{list.isDefault && (
												<span className="badge badge-subtle text-[10px]">
													Default
												</span>
											)}
										</div>
										<p className="mt-0.5 line-clamp-1 text-(--foreground-muted) text-xs">
											{list.description || "No description"}
										</p>
										<p className="mt-1 text-(--foreground-subtle) text-xs">
											{list.itemCount} items
										</p>
									</div>
								</div>
							</button>
						);
					})}
				</div>

				{/* List Content */}
				{/* scroll-mt clears the sticky h-16 header (+ breathing room) when
				    handleSelectList scrolls this into view on stacked layouts. */}
				<div ref={listContentRef} className="scroll-mt-20 lg:col-span-3">
					{activeList ? (
						<div className="space-y-6">
							{/* List Header — controls live below it, mirroring the mobile
							    layout: full-width search, then one row of pills. */}
							<div className="flex items-center justify-between gap-4">
								<div className="flex items-center gap-3">
									<div
										className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClasses[getListColor(activeList.name)]} text-white`}
									>
										{(() => {
											const ListIcon =
												iconComponents[getListColor(activeList.name)] || List;
											return <ListIcon className="h-4.5 w-4.5" />;
										})()}
									</div>
									<h2 className="text-display-3">{activeList.name}</h2>
								</div>

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
										<button
											type="button"
											onClick={() => setShowAddDialog(true)}
											className="btn btn-primary btn-sm gap-1.5 rounded-full!"
										>
											<Plus className="size-3.5" />
											Add items
										</button>
									)
								)}
							</div>

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

										{/* Reorder */}
										{sort === "position" ? (
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

							{/* Description + watched progress clustered into one card.
							    Progress is viewer-relative and hidden when signed out. */}
							{(activeList.description || (isAuthenticated && total > 0)) && (
								<div className="card space-y-2.5 p-4">
									{activeList.description && (
										<p className="text-(--foreground-muted) text-sm">
											{activeList.description}
										</p>
									)}
									{isAuthenticated && total > 0 && (
										<div className="space-y-1">
											<div className="flex items-center justify-between text-(--foreground-muted) text-xs">
												<span>
													{watchedCount} of {total} watched
												</span>
												<span>{Math.round((watchedCount / total) * 100)}%</span>
											</div>
											<div className="h-1 w-full overflow-hidden rounded-full bg-(--background-subtle)">
												<div
													className="h-full rounded-full bg-(--accent) transition-all"
													style={{
														width: `${Math.min(100, (watchedCount / total) * 100)}%`,
													}}
												/>
											</div>
										</div>
									)}
								</div>
							)}

							{/* Loading State for List Items */}
							{listLoading && (
								<PosterGridSkeleton gridClassName={LIST_ITEMS_GRID} />
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
								<div className="space-y-2">
									{/* Copy toggles by pointer type: HTML5 drag never fires from
									    touch, so coarse pointers only get the arrow-button path. */}
									<p className="text-(--foreground-muted) text-xs">
										<span className="[@media(pointer:fine)]:hidden">
											Use the arrow buttons to reorder, then press Done to save.
										</span>
										<span className="hidden [@media(pointer:fine)]:inline">
											Drag rows or use the arrow buttons to reorder, then press
											Done to save.
										</span>
									</p>
									{reorderItems.map((item, index) => (
										// biome-ignore lint/a11y/noStaticElementInteractions: drag handlers; keyboard reorder is provided via the up/down buttons
										<div
											key={item.id}
											draggable
											onDragStart={() => setDragIndex(index)}
											onDragOver={(e) => e.preventDefault()}
											onDrop={() => handleDrop(index)}
											onDragEnd={() => setDragIndex(null)}
											className={cn(
												"flex items-center gap-3 rounded-lg border border-(--border) bg-(--background-elevated) p-2",
												dragIndex === index && "opacity-50",
											)}
										>
											{/* Drag handle is useless on touch (no HTML5 drag events); show only for fine pointers. */}
											<GripVertical className="hidden size-4 shrink-0 cursor-grab text-(--foreground-muted) [@media(pointer:fine)]:block" />
											<div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-(--background-subtle)">
												{getPosterUrl(item.media) ? (
													<img
														src={getPosterUrl(item.media)}
														alt={getTitle(item.media)}
														className="h-full w-full object-cover"
														loading="lazy"
													/>
												) : (
													<div className="flex h-full w-full items-center justify-center text-(--foreground-subtle)">
														{item.mediaType === "movie" ? (
															<Film className="size-4" />
														) : (
															<Tv className="size-4" />
														)}
													</div>
												)}
											</div>
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-sm">
													{getTitle(item.media)}
												</p>
												<p className="text-(--foreground-muted) text-xs">
													{index + 1} / {reorderItems.length}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-1">
												<button
													type="button"
													aria-label="Move up"
													disabled={index === 0}
													onClick={() => moveReorderItem(index, index - 1)}
													className="btn btn-secondary btn-sm size-8 rounded-full! p-0!"
												>
													<ArrowUp className="size-3.5" />
												</button>
												<button
													type="button"
													aria-label="Move down"
													disabled={index === reorderItems.length - 1}
													onClick={() => moveReorderItem(index, index + 1)}
													className="btn btn-secondary btn-sm size-8 rounded-full! p-0!"
												>
													<ArrowDown className="size-3.5" />
												</button>
											</div>
										</div>
									))}
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
																			slug: selectedListSlug || "",
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
								)}
						</div>
					) : (
						<div className="flex h-96 flex-col items-center justify-center rounded-xl border-(--border) border-2 border-dashed">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-(--background-subtle)">
								<List className="size-8 text-(--foreground-subtle)" />
							</div>
							<h3 className="mt-4 font-display font-semibold text-lg">
								Select a list
							</h3>
							<p className="mt-1 text-(--foreground-muted)">
								Choose a list from the sidebar to view its contents
							</p>
						</div>
					)}
				</div>
			</div>

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

			{/* Create List Modal */}
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
