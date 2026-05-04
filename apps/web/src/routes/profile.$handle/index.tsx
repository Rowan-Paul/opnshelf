import {
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListsOptions,
	moviesControllerGetUserMoviesPaginatedOptions,
	showsControllerGetUserEpisodesPaginatedOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Film, Heart, List, Tv } from "lucide-react";
import ActionableMediaCard from "#/components/ActionableMediaCard";
import MediaCard from "#/components/MediaCard";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";

setupApiClient();

export const Route = createFileRoute("/profile/$handle/")({
	component: ProfileOverviewPage,
});

function ProfileOverviewPage() {
	const { handle } = Route.useParams();
	const { user } = useAuth();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const displayName = profile?.displayName || profile?.handle || handle;
	const isOwner = user?.did === userDid;

	// Fetch recent movies
	const { data: moviesData, isLoading: moviesLoading } = useQuery({
		...moviesControllerGetUserMoviesPaginatedOptions({
			path: { userDid },
			query: { limit: 8 },
		}),
		enabled: !!userDid,
	});

	// Fetch recent episodes
	const { data: episodesData, isLoading: episodesLoading } = useQuery({
		...showsControllerGetUserEpisodesPaginatedOptions({
			path: { userDid },
			query: { limit: 8 },
		}),
		enabled: !!userDid,
	});

	const movies = moviesData?.items ?? [];
	const episodes = episodesData?.items ?? [];

	// Fetch public lists
	const { data: listsData, isLoading: listsLoading } = useQuery({
		...listsControllerGetPublicUserListsOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	const totalMovies = moviesData?.total ?? 0;
	const totalEpisodes = episodesData?.total ?? 0;
	const totalLists = listsData?.length ?? 0;
	const totalWatched = (moviesData?.total ?? 0) + (episodesData?.total ?? 0);

	const watchlist = listsData?.find((l) => l.slug === "watchlist");
	const favorites = listsData?.find((l) => l.slug === "favorites");

	return (
		<div className="space-y-10">
			{/* Stats Row */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard
					label="Movies"
					value={totalMovies}
					icon={Film}
					isLoading={!moviesData && !!userDid}
				/>
				<StatCard
					label="Episodes"
					value={totalEpisodes}
					icon={Tv}
					isLoading={!episodesData && !!userDid}
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
					isLoading={!moviesData && !episodesData && !!userDid}
				/>
			</div>

			{/* Last Movies & Episodes */}
			<div className="grid gap-8 lg:grid-cols-2">
				{/* Last Movies */}
				<section>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="flex items-center gap-2 text-display-3">
							<Film className="size-5 text-(--accent)" />
							Recent Movies
						</h2>
						<Link
							to="/profile/$handle/shelf"
							params={{ handle }}
							search={{ type: "movie" }}
							className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
						>
							View all
							<ChevronRight className="size-4" />
						</Link>
					</div>

					{moviesLoading ? (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							{[1, 2, 3, 4].map((i) => (
								<div
									key={i}
									className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
								/>
							))}
						</div>
					) : movies.length > 0 ? (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							{movies.map((item) => (
								<div key={item.id} className="[&_article]:!w-full">
									<ActionableMediaCard
										id={item.movie.movieId}
										title={item.movie.title}
										posterUrl={`https://image.tmdb.org/t/p/w500${item.movie.posterPath}`}
										type="movie"
										watchedDate={item.watchedDate}
										interactive={isOwner}
										isWatched={true}
									/>
								</div>
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

				{/* Last Episodes */}
				<section>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="flex items-center gap-2 text-display-3">
							<Tv className="size-5 text-(--accent)" />
							Recent Episodes
						</h2>
						<Link
							to="/profile/$handle/shelf"
							params={{ handle }}
							search={{ type: "episode" }}
							className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
						>
							View all
							<ChevronRight className="size-4" />
						</Link>
					</div>

					{episodesLoading ? (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							{[1, 2, 3, 4].map((i) => (
								<div
									key={i}
									className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
								/>
							))}
						</div>
					) : episodes.length > 0 ? (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							{episodes.map((item) => (
								<div key={item.id} className="[&_article]:!w-full">
									<ActionableMediaCard
										id={item.show.showId}
										title={item.show.title}
										posterUrl={`https://image.tmdb.org/t/p/w500${item.show.posterPath}`}
										type="show"
										seasonNumber={item.seasonNumber}
										episodeNumber={item.episodeNumber}
										episodeInfo={`S${item.seasonNumber}E${item.episodeNumber}`}
										watchedDate={item.watchedDate}
										interactive={isOwner}
										isWatched={true}
									/>
								</div>
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
			</div>

			{/* Lists Preview */}
			<div className="grid gap-8 lg:grid-cols-2">
				<ListPreview
					title="Watchlist"
					list={watchlist}
					handle={handle}
					userDid={userDid}
					icon={Clock}
					emptyText="Nothing on watchlist"
				/>
				<ListPreview
					title="Favorites"
					list={favorites}
					handle={handle}
					userDid={userDid}
					icon={Heart}
					emptyText="Nothing on favorites"
				/>
			</div>
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
	userDid,
	icon: Icon,
	emptyText,
}: {
	title: string;
	list?: { slug: string; itemCount: number };
	handle: string;
	userDid: string;
	icon: React.ComponentType<{ className?: string }>;
	emptyText: string;
}) {
	const { data: listDetails, isLoading: itemsLoading } = useQuery({
		...listsControllerGetPublicUserListOptions({
			path: { userDid, slug: list?.slug || "" },
		}),
		enabled: !!list && list.itemCount > 0,
	});

	const items = listDetails?.items?.slice(0, 4) ?? [];

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
						<ChevronRight className="size-4" />
					</Link>
				)}
			</div>

			{!list || list.itemCount === 0 ? (
				<div className="card p-6 text-center">
					<p className="text-(--foreground-muted)">{emptyText}</p>
				</div>
			) : itemsLoading ? (
				<div className="grid grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
						/>
					))}
				</div>
			) : items.length > 0 ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					{items.map((item) => {
						const media = item.media as Record<string, unknown>;
						const posterPath = media.posterPath as string | undefined;
						const title = (media.title as string) || "Unknown";
						const mediaId = (media.mediaId as string) || item.mediaId;
						const isEpisode =
							item.seasonNumber != null && item.episodeNumber != null;

						return (
							<div key={item.id} className="[&_article]:!w-full">
								<MediaCard
									id={mediaId}
									title={title}
									seasonNumber={item.seasonNumber}
									episodeNumber={item.episodeNumber}
									episodeInfo={
										isEpisode
											? item.episodeName
												? `S${item.seasonNumber}E${item.episodeNumber} — ${item.episodeName}`
												: `S${item.seasonNumber}E${item.episodeNumber}`
											: undefined
									}
									posterUrl={
										posterPath
											? `https://image.tmdb.org/t/p/w500${posterPath}`
											: ""
									}
									type={item.mediaType as "movie" | "show"}
									href={
										isEpisode
											? `/show/${mediaId}/season/${item.seasonNumber}/episode/${item.episodeNumber}`
											: item.mediaType === "movie"
												? `/movie/${mediaId}`
												: `/show/${mediaId}`
									}
								/>
							</div>
						);
					})}
				</div>
			) : (
				<div className="card p-6 text-center">
					<p className="text-(--foreground-muted)">{emptyText}</p>
				</div>
			)}
		</section>
	);
}
