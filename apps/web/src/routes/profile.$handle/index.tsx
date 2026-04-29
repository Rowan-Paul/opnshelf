import {
	listsControllerGetPublicUserListsOptions,
	moviesControllerGetUserMoviesPaginatedOptions,
	moviesControllerUnmarkWatchedMutation,
	shelfControllerGetUserShelfOptions,
	shelfControllerGetUserShelfQueryKey,
	showsControllerGetUserEpisodesPaginatedOptions,
	showsControllerUnmarkWatchedMutation,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ChevronRight,
	Clock,
	Film,
	Heart,
	List,
	Loader2,
	Tv,
	X,
} from "lucide-react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { toSlug } from "#/lib/slug";

setupApiClient();

export const Route = createFileRoute("/profile/$handle/")({
	component: ProfileOverviewPage,
});

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

function ProfileOverviewPage() {
	const { handle } = Route.useParams();
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const displayName = profile?.displayName || profile?.handle || handle;
	const isOwner = user?.did === userDid;

	// Fetch recent shelf items (mixed, we'll split client-side for overview)
	const { data: shelfData, isLoading: shelfLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { page: 1, pageSize: 24 },
		}),
		enabled: !!userDid,
	});

	const movies =
		shelfData?.items?.filter((item) => item.type === "movie").slice(0, 6) ?? [];
	const episodes =
		shelfData?.items?.filter((item) => item.type === "episode").slice(0, 6) ??
		[];

	// Fetch public lists
	const { data: listsData, isLoading: listsLoading } = useQuery({
		...listsControllerGetPublicUserListsOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	// Fetch total counts
	const { data: moviesCountData } = useQuery({
		...moviesControllerGetUserMoviesPaginatedOptions({
			path: { userDid },
			query: { limit: 1 },
		}),
		enabled: !!userDid,
	});
	const { data: episodesCountData } = useQuery({
		...showsControllerGetUserEpisodesPaginatedOptions({
			path: { userDid },
			query: { limit: 1 },
		}),
		enabled: !!userDid,
	});

	const watchlist = listsData?.find((l) => l.slug === "watchlist");
	const favorites = listsData?.find((l) => l.slug === "favorites");

	const totalMovies = moviesCountData?.total ?? 0;
	const totalEpisodes = episodesCountData?.total ?? 0;
	const totalLists = listsData?.length ?? 0;
	const totalWatched = shelfData?.total ?? 0;

	// Mutations for removing from shelf
	const removeMovieMutation = useMutation({
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: shelfControllerGetUserShelfQueryKey({
					path: { userDid },
				}),
			});
		},
	});
	const removeEpisodeMutation = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: shelfControllerGetUserShelfQueryKey({
					path: { userDid },
				}),
			});
		},
	});

	return (
		<div className="space-y-10">
			{/* Stats Row */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard
					label="Movies"
					value={totalMovies}
					icon={Film}
					isLoading={!moviesCountData && !!userDid}
				/>
				<StatCard
					label="Episodes"
					value={totalEpisodes}
					icon={Tv}
					isLoading={!episodesCountData && !!userDid}
				/>
				<StatCard
					label="Lists"
					value={totalLists}
					icon={List}
					isLoading={listsLoading}
				/>
				<StatCard
					label="Watched"
					value={totalWatched}
					icon={Clock}
					isLoading={shelfLoading}
				/>
			</div>

			{/* Last 6 Movies */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-display-3">
						<Film className="h-5 w-5 text-(--accent)" />
						Last Movies
					</h2>
					<Link
						to="/profile/$handle/shelf"
						params={{ handle }}
						search={{ type: "movie" }}
						className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
					>
						View all
						<ChevronRight className="h-4 w-4" />
					</Link>
				</div>

				{shelfLoading ? (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div
								key={i}
								className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
							/>
						))}
					</div>
				) : movies.length > 0 ? (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
						{movies.map((item) => (
							<ShelfItemCard
								key={item.id}
								item={item}
								isOwner={isOwner}
								onRemove={() =>
									removeMovieMutation.mutate({
										path: { movieId: item.movieId },
										query: { mode: "all" },
									})
								}
								isRemoving={removeMovieMutation.isPending}
							/>
						))}
					</div>
				) : (
					<div className="card p-8 text-center">
						<p className="text-(--foreground-muted)">
							{displayName} hasn&apos;t watched any movies yet.
						</p>
					</div>
				)}
			</section>

			{/* Last 6 Episodes */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-display-3">
						<Tv className="h-5 w-5 text-(--accent)" />
						Last Episodes
					</h2>
					<Link
						to="/profile/$handle/shelf"
						params={{ handle }}
						search={{ type: "episode" }}
						className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
					>
						View all
						<ChevronRight className="h-4 w-4" />
					</Link>
				</div>

				{shelfLoading ? (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div
								key={i}
								className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
							/>
						))}
					</div>
				) : episodes.length > 0 ? (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
						{episodes.map((item) => (
							<ShelfItemCard
								key={item.id}
								item={item}
								isOwner={isOwner}
								onRemove={() =>
									removeEpisodeMutation.mutate({
										path: { showId: item.showId },
										query: {
											seasonNumber: item.seasonNumber,
											episodeNumber: item.episodeNumber,
											mode: "all",
										},
									})
								}
								isRemoving={removeEpisodeMutation.isPending}
							/>
						))}
					</div>
				) : (
					<div className="card p-8 text-center">
						<p className="text-(--foreground-muted)">
							{displayName} hasn&apos;t watched any episodes yet.
						</p>
					</div>
				)}
			</section>

			{/* Lists Preview */}
			<div className="grid gap-8 lg:grid-cols-2">
				<ListPreview
					title="Watchlist"
					list={watchlist}
					handle={handle}
					isLoading={listsLoading}
					icon={Clock}
					emptyText="Nothing on watchlist"
				/>
				<ListPreview
					title="Favorites"
					list={favorites}
					handle={handle}
					isLoading={listsLoading}
					icon={Heart}
					emptyText="Nothing on favorites"
				/>
			</div>
		</div>
	);
}

function ShelfItemCard({
	item,
	isOwner,
	onRemove,
	isRemoving,
}: {
	item: {
		id: string;
		type: "movie" | "episode";
		posterPath?: string;
		watchedDate?: string;
	} & Record<string, unknown>;
	isOwner: boolean;
	onRemove: () => void;
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

			{/* Remove button */}
			{isOwner && (
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onRemove();
					}}
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

function StatCard({
	label,
	value,
	icon: Icon,
	isLoading,
}: {
	label: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
	isLoading: boolean;
}) {
	return (
		<div className="card p-4">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent-subtle) text-(--accent)">
					<Icon className="h-5 w-5" />
				</div>
				<div>
					{isLoading ? (
						<div className="h-6 w-8 animate-pulse rounded bg-(--background-subtle)" />
					) : (
						<p className="font-semibold text-lg">{value}</p>
					)}
					<p className="text-(--foreground-muted) text-sm">{label}</p>
				</div>
			</div>
		</div>
	);
}

function ListPreview({
	title,
	list,
	handle,
	isLoading,
	icon: Icon,
	emptyText,
}: {
	title: string;
	list?: { slug: string; itemCount: number };
	handle: string;
	isLoading: boolean;
	icon: React.ComponentType<{ className?: string }>;
	emptyText: string;
}) {
	return (
		<section>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="flex items-center gap-2 text-display-3">
					<Icon className="h-5 w-5 text-(--accent)" />
					{title}
				</h2>
				{list && (
					<Link
						to="/profile/$handle/lists/$listSlug"
						params={{ handle, listSlug: list.slug }}
						className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
					>
						View all
						<ChevronRight className="h-4 w-4" />
					</Link>
				)}
			</div>

			{isLoading ? (
				<div className="grid grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
						/>
					))}
				</div>
			) : list && list.itemCount > 0 ? (
				<Link
					to="/profile/$handle/lists/$listSlug"
					params={{ handle, listSlug: list.slug }}
					className="card card-interactive flex items-center justify-between p-4"
				>
					<div>
						<h3 className="font-semibold">{title}</h3>
						<p className="text-(--foreground-muted) text-sm">
							{list.itemCount} item{list.itemCount === 1 ? "" : "s"}
						</p>
					</div>
					<ChevronRight className="h-5 w-5 text-(--foreground-muted)" />
				</Link>
			) : (
				<div className="card p-6 text-center">
					<p className="text-(--foreground-muted)">{emptyText}</p>
				</div>
			)}
		</section>
	);
}
