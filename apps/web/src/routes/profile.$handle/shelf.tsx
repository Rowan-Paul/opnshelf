import {
	moviesControllerUnmarkWatchedMutation,
	shelfControllerGetUserShelfOptions,
	shelfControllerGetUserShelfQueryKey,
	showsControllerUnmarkWatchedMutation,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Film,
	Grid3X3,
	List as ListIcon,
	Loader2,
	Search,
	Tv,
	X,
} from "lucide-react";
import { useState } from "react";
import { Pagination } from "#/components/Pagination";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { toSlug } from "#/lib/slug";

setupApiClient();

export const Route = createFileRoute("/profile/$handle/shelf")({
	component: ProfileShelfPage,
});

type FilterType = "all" | "movie" | "episode";
type ViewMode = "grid" | "list";

function formatWatchedDate(dateStr?: string): string {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year:
			date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
	});
}

function ProfileShelfPage() {
	const { handle } = Route.useParams();
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const displayName = profile?.displayName || profile?.handle || handle;
	const isOwner = user?.did === userDid;

	const [filter, setFilter] = useState<FilterType>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [page, setPage] = useState(1);

	// Server-side pagination with filtering
	const { data, isLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: {
				page,
				pageSize: 24,
				...(filter !== "all" ? { type: filter } : {}),
				...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
			},
		}),
		enabled: !!userDid,
	});

	const handleFilterChange = (newFilter: FilterType) => {
		setFilter(newFilter);
		setPage(1);
	};

	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		setPage(1);
	};

	// Mutations for removing from shelf
	const removeMovieMutation = useMutation({
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: shelfControllerGetUserShelfQueryKey({ path: { userDid } }),
			});
		},
	});
	const removeEpisodeMutation = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: shelfControllerGetUserShelfQueryKey({ path: { userDid } }),
			});
		},
	});

	const items = data?.items ?? [];

	return (
		<div className="space-y-6">
			{/* Title & Controls */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-display-2">{displayName}&apos;s Shelf</h1>

				<div className="flex items-center gap-3">
					{/* Search */}
					<div className="relative">
						<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--foreground-muted)" />
						<input
							type="text"
							placeholder="Search shelf..."
							className="input h-9 w-48 pl-9! text-sm"
							value={searchQuery}
							onChange={(e) => handleSearchChange(e.target.value)}
						/>
					</div>

					{/* View Toggle */}
					<div className="flex rounded-lg border border-(--border) bg-(--background-elevated) p-0.5">
						<button
							type="button"
							onClick={() => setViewMode("grid")}
							className={`rounded-md p-1.5 transition-colors ${
								viewMode === "grid"
									? "bg-(--accent) text-[#3f2e00]"
									: "text-(--foreground-muted) hover:text-(--foreground)"
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
									? "bg-(--accent) text-[#3f2e00]"
									: "text-(--foreground-muted) hover:text-(--foreground)"
							}`}
							aria-label="List view"
						>
							<ListIcon className="h-4 w-4" />
						</button>
					</div>
				</div>
			</div>

			{/* Filter Tabs */}
			<div className="flex gap-2">
				{(
					[
						{ key: "all", label: "All", icon: undefined },
						{ key: "movie", label: "Movies", icon: Film },
						{ key: "episode", label: "TV Episodes", icon: Tv },
					] as const
				).map((f) => {
					const Icon = f.icon;
					return (
						<button
							key={f.key}
							type="button"
							onClick={() => handleFilterChange(f.key)}
							className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors ${
								filter === f.key
									? "bg-(--accent) text-[#3f2e00]"
									: "bg-(--background-elevated) text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--foreground)"
							}`}
						>
							{Icon && <Icon className="h-4 w-4" />}
							{f.label}
						</button>
					);
				})}
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div
							key={i}
							className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
						/>
					))}
				</div>
			) : items.length === 0 ? (
				<div className="card p-8 text-center">
					<p className="text-(--foreground-muted)">
						{searchQuery
							? "No results found."
							: `${displayName}'s shelf is empty.`}
					</p>
				</div>
			) : viewMode === "grid" ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
					{items.map((item) => (
						<ShelfGridCard
							key={item.id}
							item={item}
							isOwner={isOwner}
							onRemoveMovie={(movieId) =>
								removeMovieMutation.mutate({
									path: { movieId },
									query: { mode: "all" },
								})
							}
							onRemoveEpisode={(showId, seasonNumber, episodeNumber) =>
								removeEpisodeMutation.mutate({
									path: { showId },
									query: {
										seasonNumber,
										episodeNumber,
										mode: "all",
									},
								})
							}
							isRemoving={
								removeMovieMutation.isPending || removeEpisodeMutation.isPending
							}
						/>
					))}
				</div>
			) : (
				<div className="space-y-2">
					{items.map((item) => (
						<ShelfListRow
							key={item.id}
							item={item}
							isOwner={isOwner}
							onRemoveMovie={(movieId) =>
								removeMovieMutation.mutate({
									path: { movieId },
									query: { mode: "all" },
								})
							}
							onRemoveEpisode={(showId, seasonNumber, episodeNumber) =>
								removeEpisodeMutation.mutate({
									path: { showId },
									query: {
										seasonNumber,
										episodeNumber,
										mode: "all",
									},
								})
							}
							isRemoving={
								removeMovieMutation.isPending || removeEpisodeMutation.isPending
							}
						/>
					))}
				</div>
			)}

			{/* Pagination */}
			{data && data.totalPages > 1 && (
				<div className="flex justify-center pt-4">
					<Pagination
						page={data.page}
						totalPages={data.totalPages}
						onPageChange={setPage}
					/>
				</div>
			)}
		</div>
	);
}

function ShelfGridCard({
	item,
	isOwner,
	onRemoveMovie,
	onRemoveEpisode,
	isRemoving,
}: {
	item: {
		id: string;
		type: "movie" | "episode";
		posterPath?: string;
		watchedDate?: string;
	} & Record<string, unknown>;
	isOwner: boolean;
	onRemoveMovie: (movieId: string) => void;
	onRemoveEpisode: (
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	) => void;
	isRemoving: boolean;
}) {
	const isMovie = item.type === "movie";
	const title = isMovie ? (item.title as string) : (item.showTitle as string);
	const id = isMovie ? (item.movieId as string) : (item.showId as string);
	const year = isMovie
		? (item.releaseYear as number | undefined)
		: (item.firstAirYear as number | undefined);

	const episodeInfo = !isMovie
		? `S${item.seasonNumber}E${item.episodeNumber}${item.episodeTitle ? ` — ${item.episodeTitle}` : ""}`
		: undefined;

	const handleRemove = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (isMovie) {
			onRemoveMovie(id);
		} else {
			onRemoveEpisode(
				id,
				item.seasonNumber as number,
				item.episodeNumber as number,
			);
		}
	};

	return (
		<div className="group relative">
			<Link
				to={
					isMovie ? "/movies/$movieId/$movieName" : "/shows/$showId/$showName"
				}
				params={
					isMovie
						? { movieId: id, movieName: toSlug(title) }
						: { showId: id, showName: toSlug(title) }
				}
				className="block"
			>
				<div className="aspect-[2/3] overflow-hidden rounded-lg bg-(--background-subtle)">
					{item.posterPath ? (
						<img
							src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
							alt={title}
							className="h-full w-full object-cover transition-transform group-hover:scale-105"
							loading="lazy"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							{isMovie ? (
								<Film className="h-8 w-8 text-(--foreground-muted)" />
							) : (
								<Tv className="h-8 w-8 text-(--foreground-muted)" />
							)}
						</div>
					)}
				</div>
				<div className="mt-2">
					<p className="truncate font-medium text-sm">{title}</p>
					<div className="flex flex-col gap-0.5 text-(--foreground-muted) text-xs">
						{year && <span>{year}</span>}
						{episodeInfo && <span>{episodeInfo}</span>}
						{item.watchedDate && (
							<span>{formatWatchedDate(item.watchedDate)}</span>
						)}
					</div>
				</div>
			</Link>

			{isOwner && (
				<button
					type="button"
					onClick={handleRemove}
					disabled={isRemoving}
					className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-red-500 disabled:opacity-100 group-hover:opacity-100"
					aria-label="Remove from shelf"
				>
					{isRemoving ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<X className="h-3.5 w-3.5" />
					)}
				</button>
			)}
		</div>
	);
}

function ShelfListRow({
	item,
	isOwner,
	onRemoveMovie,
	onRemoveEpisode,
	isRemoving,
}: {
	item: {
		id: string;
		type: "movie" | "episode";
		posterPath?: string;
		watchedDate?: string;
	} & Record<string, unknown>;
	isOwner: boolean;
	onRemoveMovie: (movieId: string) => void;
	onRemoveEpisode: (
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	) => void;
	isRemoving: boolean;
}) {
	const isMovie = item.type === "movie";
	const title = isMovie ? (item.title as string) : (item.showTitle as string);
	const id = isMovie ? (item.movieId as string) : (item.showId as string);

	const episodeInfo = !isMovie
		? `S${item.seasonNumber}E${item.episodeNumber}${item.episodeTitle ? ` — ${item.episodeTitle}` : ""}`
		: undefined;

	const handleRemove = () => {
		if (isMovie) {
			onRemoveMovie(id);
		} else {
			onRemoveEpisode(
				id,
				item.seasonNumber as number,
				item.episodeNumber as number,
			);
		}
	};

	return (
		<Link
			to={isMovie ? "/movies/$movieId/$movieName" : "/shows/$showId/$showName"}
			params={
				isMovie
					? { movieId: id, movieName: toSlug(title) }
					: { showId: id, showName: toSlug(title) }
			}
			className="card card-interactive flex items-center gap-4 p-3"
		>
			<div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-(--background-subtle)">
				{item.posterPath ? (
					<img
						src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
						alt={title}
						className="h-full w-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center">
						{isMovie ? (
							<Film className="h-4 w-4 text-(--foreground-muted)" />
						) : (
							<Tv className="h-4 w-4 text-(--foreground-muted)" />
						)}
					</div>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">{title}</p>
				<div className="flex flex-col gap-0.5 text-(--foreground-muted) text-xs">
					{episodeInfo && <span>{episodeInfo}</span>}
					{item.watchedDate && (
						<span>{formatWatchedDate(item.watchedDate)}</span>
					)}
				</div>
			</div>
			<span
				className={`badge ${isMovie ? "badge-subtle" : "badge-accent"} text-xs`}
			>
				{isMovie ? "Movie" : "TV"}
			</span>
			{isOwner && (
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleRemove();
					}}
					disabled={isRemoving}
					className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-(--border) bg-(--background-elevated) text-(--foreground-muted) transition-colors hover:border-red-300 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
					aria-label="Remove from shelf"
				>
					{isRemoving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<X className="h-4 w-4" />
					)}
				</button>
			)}
		</Link>
	);
}
