import type { MediaInListDto } from "@opnshelf/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	Clock,
	Film,
	Grid3X3,
	Heart,
	List,
	List as ListIcon,
	Loader2,
	MoreHorizontal,
	Plus,
	Search,
	SortAsc,
	Star,
	Tv,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useAuth } from "#/lib/auth-context";
import { useCreateList, useList, useUserLists } from "#/lib/hooks";
import MediaCard from "../components/MediaCard";

export const Route = createFileRoute("/lists")({
	component: ListsPage,
});

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

// Helper to get color based on list name
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

// Helper to format duration from runtime
function formatDuration(minutes?: number): string | undefined {
	if (!minutes) return undefined;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// Helper to get poster URL from media data
function getPosterUrl(media: Record<string, unknown>): string {
	if (media.poster_path && typeof media.poster_path === "string") {
		return `https://image.tmdb.org/t/p/w500${media.poster_path}`;
	}
	if (media.posterPath && typeof media.posterPath === "string") {
		return `https://image.tmdb.org/t/p/w500${media.posterPath}`;
	}
	return "";
}

// Helper to get backdrop URL from media data
function getBackdropUrl(media: Record<string, unknown>): string | undefined {
	if (media.backdrop_path && typeof media.backdrop_path === "string") {
		return `https://image.tmdb.org/t/p/original${media.backdrop_path}`;
	}
	if (media.backdropPath && typeof media.backdropPath === "string") {
		return `https://image.tmdb.org/t/p/original${media.backdropPath}`;
	}
	return undefined;
}

// Helper to get title from media data
function getTitle(media: Record<string, unknown>): string {
	if (media.title && typeof media.title === "string") return media.title;
	if (media.name && typeof media.name === "string") return media.name;
	return "Unknown";
}

// Helper to get year from media data
function getYear(media: Record<string, unknown>): number | undefined {
	if (media.release_date && typeof media.release_date === "string") {
		return new Date(media.release_date).getFullYear();
	}
	if (media.first_air_date && typeof media.first_air_date === "string") {
		return new Date(media.first_air_date).getFullYear();
	}
	if (media.releaseYear && typeof media.releaseYear === "number") {
		return media.releaseYear;
	}
	return undefined;
}

// Helper to get rating from media data
function getRating(media: Record<string, unknown>): number | undefined {
	if (media.vote_average && typeof media.vote_average === "number") {
		return media.vote_average;
	}
	if (media.voteAverage && typeof media.voteAverage === "number") {
		return media.voteAverage;
	}
	return undefined;
}

function ListsPage() {
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();

	// Redirect to login if not authenticated
	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	const [selectedListSlug, setSelectedListSlug] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newListName, setNewListName] = useState("");
	const [newListDescription, setNewListDescription] = useState("");
	const [searchQuery, setSearchQuery] = useState("");

	// Fetch user lists
	const {
		data: userLists,
		isLoading: listsLoading,
		error: listsError,
	} = useUserLists();

	// Get the first list's slug when lists load
	useMemo(() => {
		if (userLists && userLists.length > 0 && !selectedListSlug) {
			setSelectedListSlug(userLists[0].slug);
		}
	}, [userLists, selectedListSlug]);

	// Fetch selected list details with items
	const {
		data: listDetails,
		isLoading: listLoading,
		error: listError,
	} = useList(selectedListSlug || "");

	// Create list mutation
	const createListMutation = useCreateList();

	const activeList = useMemo(() => {
		if (!userLists) return null;
		return userLists.find((list) => list.slug === selectedListSlug);
	}, [userLists, selectedListSlug]);

	// Filter items based on search query
	const filteredItems = useMemo(() => {
		if (!listDetails?.items) return [];
		if (!searchQuery.trim()) return listDetails.items;

		const query = searchQuery.toLowerCase();
		return listDetails.items.filter((item: MediaInListDto) => {
			const title = getTitle(item.media).toLowerCase();
			return title.includes(query);
		});
	}, [listDetails?.items, searchQuery]);

	const handleCreateList = async () => {
		if (!newListName.trim()) return;

		try {
			await createListMutation.mutateAsync({
				body: {
					name: newListName.trim(),
					description: newListDescription.trim() || undefined,
				},
			});
			setShowCreateModal(false);
			setNewListName("");
			setNewListDescription("");
		} catch (error) {
			console.error("Failed to create list:", error);
		}
	};

	// Show loading state
	if (listsLoading) {
		return (
			<div className="container-app py-8">
				<div className="flex items-center justify-center h-64">
					<Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
					<span className="ml-2 text-[var(--foreground-muted)]">
						Loading lists...
					</span>
				</div>
			</div>
		);
	}

	// Show error state
	if (listsError) {
		return (
			<div className="container-app py-8">
				<div className="flex flex-col items-center justify-center h-64 gap-4">
					<AlertCircle className="h-12 w-12 text-red-500" />
					<div className="text-center">
						<h3 className="font-semibold text-[var(--foreground)]">
							Failed to load lists
						</h3>
						<p className="text-sm text-[var(--foreground-muted)]">
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
			<div className="container-app py-8">
				<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
							<List className="h-5 w-5" />
						</div>
						<div>
							<h1 className="text-display-2">Lists</h1>
							<p className="text-[var(--foreground-muted)]">
								Organize and manage your collections
							</p>
						</div>
					</div>

					<button
						type="button"
						onClick={() => setShowCreateModal(true)}
						className="btn btn-primary gap-2"
					>
						<Plus className="h-4 w-4" />
						Create List
					</button>
				</div>

				<div className="flex h-96 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)]">
					<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--background-subtle)]">
						<List className="h-8 w-8 text-[var(--foreground-subtle)]" />
					</div>
					<h3 className="mt-4 font-display text-lg font-semibold">
						No lists yet
					</h3>
					<p className="mt-1 text-[var(--foreground-muted)] max-w-md text-center">
						Create your first list to start organizing movies and shows you want
						to watch
					</p>
					<button
						type="button"
						onClick={() => setShowCreateModal(true)}
						className="mt-4 btn btn-primary gap-2"
					>
						<Plus className="h-4 w-4" />
						Create Your First List
					</button>
				</div>

				{/* Create List Modal */}
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
								<label htmlFor="list-name" className="text-sm font-medium">
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
									className="text-sm font-medium"
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
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Creating...
									</>
								) : (
									"Create List"
								)}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		);
	}

	return (
		<div className="container-app py-8">
			{/* Header */}
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
						<List className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-display-2">Lists</h1>
						<p className="text-[var(--foreground-muted)]">
							Organize and manage your collections
						</p>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setShowCreateModal(true)}
					className="btn btn-primary gap-2"
				>
					<Plus className="h-4 w-4" />
					Create List
				</button>
			</div>

			<div className="grid gap-8 lg:grid-cols-4">
				{/* Lists Sidebar */}
				<div className="space-y-3">
					{userLists?.map((list) => {
						const color = getListColor(list.name);
						const Icon = iconComponents[color] || List;
						return (
							<button
								key={list.id}
								type="button"
								onClick={() => setSelectedListSlug(list.slug)}
								className={`w-full text-left card card-interactive p-4 transition-all ${
									selectedListSlug === list.slug
										? "border-[var(--accent)] bg-[var(--accent-subtle)]"
										: ""
								}`}
							>
								<div className="flex items-start gap-3">
									<div
										className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${colorClasses[color]} text-white`}
									>
										<Icon className="h-5 w-5" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<h3 className="font-semibold text-[var(--foreground)] truncate">
												{list.name}
											</h3>
											{list.isDefault && (
												<span className="badge badge-subtle text-[10px]">
													Default
												</span>
											)}
										</div>
										<p className="mt-0.5 text-xs text-[var(--foreground-muted)] line-clamp-1">
											{list.description || "No description"}
										</p>
										<p className="mt-1 text-xs text-[var(--foreground-subtle)]">
											{list.itemCount} items
										</p>
									</div>
								</div>
							</button>
						);
					})}
				</div>

				{/* List Content */}
				<div className="lg:col-span-3">
					{activeList ? (
						<div className="space-y-6">
							{/* List Header */}
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 className="text-display-3">{activeList.name}</h2>
									<p className="text-[var(--foreground-muted)]">
										{activeList.description || "No description"}
									</p>
								</div>

								<div className="flex items-center gap-2">
									{/* Search */}
									<div className="relative">
										<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
										<input
											type="text"
											placeholder="Search list..."
											className="input h-9 w-48 !pl-9 text-sm"
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
										/>
									</div>

									{/* Sort */}
									<button
										type="button"
										className="btn btn-secondary h-9 w-9 p-0"
										aria-label="Sort"
									>
										<SortAsc className="h-4 w-4" />
									</button>

									{/* View Toggle */}
									<div className="flex rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-0.5">
										<button
											type="button"
											onClick={() => setViewMode("grid")}
											className={`rounded-md p-1.5 transition-colors ${
												viewMode === "grid"
													? "bg-[var(--accent)] text-[#3f2e00]"
													: "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
											}`}
											aria-label="Grid view"
										>
											<Grid3X3 className="h-4 w-4" />
										</button>
										<button
											type="button"
											onClick={() => setViewMode("list")}
											className={`rounded-md p-1.5 transition-colors ${
												viewMode === "list"
													? "bg-[var(--accent)] text-[#3f2e00]"
													: "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
											}`}
											aria-label="List view"
										>
											<ListIcon className="h-4 w-4" />
										</button>
									</div>

									{/* More options */}
									<button
										type="button"
										className="btn btn-secondary h-9 w-9 p-0"
										aria-label="More options"
									>
										<MoreHorizontal className="h-4 w-4" />
									</button>
								</div>
							</div>

							{/* Loading State for List Items */}
							{listLoading && (
								<div className="flex items-center justify-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
									<span className="ml-2 text-[var(--foreground-muted)]">
										Loading items...
									</span>
								</div>
							)}

							{/* Error State for List Items */}
							{listError && !listLoading && (
								<div className="flex flex-col items-center justify-center h-64 gap-4">
									<AlertCircle className="h-12 w-12 text-red-500" />
									<div className="text-center">
										<h3 className="font-semibold text-[var(--foreground)]">
											Failed to load list items
										</h3>
										<p className="text-sm text-[var(--foreground-muted)]">
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

							{/* Empty State */}
							{!listLoading && !listError && filteredItems.length === 0 && (
								<div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)]">
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background-subtle)]">
										<List className="h-6 w-6 text-[var(--foreground-subtle)]" />
									</div>
									<h3 className="mt-3 font-display font-semibold">
										{searchQuery ? "No results found" : "List is empty"}
									</h3>
									<p className="mt-1 text-sm text-[var(--foreground-muted)]">
										{searchQuery
											? "Try adjusting your search query"
											: "Add movies and shows to this list to see them here"}
									</p>
								</div>
							)}

							{/* Items Grid/List */}
							{!listLoading &&
								!listError &&
								filteredItems.length > 0 &&
								(viewMode === "grid" ? (
									<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
										{filteredItems
											// Deduplicate by ID to prevent React key warnings
											.filter(
												(item, index, self) =>
													index === self.findIndex((i) => i.id === item.id),
											)
											.map((item: MediaInListDto) => (
												<MediaCard
													key={item.id}
													id={item.mediaId}
													title={getTitle(item.media)}
													posterUrl={getPosterUrl(item.media)}
													backdropUrl={getBackdropUrl(item.media)}
													type={item.mediaType as "movie" | "show"}
													year={getYear(item.media)}
													rating={getRating(item.media)}
													duration={formatDuration(
														item.media.runtime as number | undefined,
													)}
													size="md"
													layout="poster"
												/>
											))}
									</div>
								) : (
									<div className="space-y-2">
										{filteredItems
											// Deduplicate by ID to prevent React key warnings
											.filter(
												(item, index, self) =>
													index === self.findIndex((i) => i.id === item.id),
											)
											.map((item: MediaInListDto) => (
												<div
													key={item.id}
													className="card card-interactive flex items-center gap-4 p-3"
												>
													<img
														src={getPosterUrl(item.media)}
														alt={getTitle(item.media)}
														className="h-20 w-14 rounded-lg object-cover"
														loading="lazy"
													/>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2">
															<h3 className="font-semibold">
																{getTitle(item.media)}
															</h3>
															<span
																className={`badge ${
																	item.mediaType === "movie"
																		? "badge-subtle"
																		: "badge-accent"
																}`}
															>
																{item.mediaType === "movie" ? "Movie" : "TV"}
															</span>
														</div>
														<div className="mt-1 flex items-center gap-3 text-sm text-[var(--foreground-muted)]">
															{getYear(item.media) && (
																<span>{getYear(item.media)}</span>
															)}
															{getRating(item.media) && (
																<>
																	<span>•</span>
																	<span className="flex items-center gap-1">
																		<Star className="h-3 w-3 fill-current text-yellow-500" />
																		{getRating(item.media)?.toFixed(1)}
																	</span>
																</>
															)}
															{formatDuration(
																item.media.runtime as number | undefined,
															) && (
																<>
																	<span>•</span>
																	<span>
																		{formatDuration(
																			item.media.runtime as number | undefined,
																		)}
																	</span>
																</>
															)}
														</div>
													</div>
													<button
														type="button"
														className="btn btn-ghost h-8 w-8 p-0 text-[var(--foreground-muted)]"
													>
														<MoreHorizontal className="h-4 w-4" />
													</button>
												</div>
											))}
									</div>
								))}
						</div>
					) : (
						<div className="flex h-96 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)]">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--background-subtle)]">
								<List className="h-8 w-8 text-[var(--foreground-subtle)]" />
							</div>
							<h3 className="mt-4 font-display text-lg font-semibold">
								Select a list
							</h3>
							<p className="mt-1 text-[var(--foreground-muted)]">
								Choose a list from the sidebar to view its contents
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Create List Modal */}
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
							<label htmlFor="list-name" className="text-sm font-medium">
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
							<label htmlFor="list-description" className="text-sm font-medium">
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
						<Button variant="outline" onClick={() => setShowCreateModal(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleCreateList}
							disabled={!newListName.trim() || createListMutation.isPending}
						>
							{createListMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Creating...
								</>
							) : (
								"Create List"
							)}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
