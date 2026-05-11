import {
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListsOptions,
	moviesControllerGetUserMoviesPaginatedOptions,
	reviewsControllerGetUserReviewsQueryKey,
	reviewsControllerUpsertReviewMutation,
	showsControllerGetUserEpisodesPaginatedOptions,
	type UserReviewDto,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Film, Heart, List, Star, Tv } from "lucide-react";
import { toast } from "sonner";
import ActionableMediaCard from "#/components/ActionableMediaCard";
import MediaCard from "#/components/MediaCard";
import StarRating from "#/components/StarRating";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { useUserReviews } from "#/lib/hooks/useReviews";
import { toSlug } from "#/lib/slug";

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

	const { data: reviewsData, isLoading: reviewsLoading } = useUserReviews({
		userDid,
		limit: 4,
	});
	const totalReviews = reviewsData?.total ?? 0;

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
				<StatCard
					label="Reviews"
					value={totalReviews}
					icon={Star}
					isLoading={reviewsLoading}
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
								No movies watched yet.
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
								No episodes watched yet.
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

			{/* Recent Reviews */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-display-3">
						<Star className="size-5 text-(--accent)" />
						Recent Reviews
					</h2>
					<Link
						to="/profile/$handle/reviews"
						params={{ handle }}
						className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
					>
						View all
						<ChevronRight className="size-4" />
					</Link>
				</div>

				{reviewsLoading ? (
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
							/>
						))}
					</div>
				) : reviewsData?.items && reviewsData.items.length > 0 ? (
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{reviewsData.items.map((review) => (
							<ProfileReviewCard
								key={review.id}
								review={review}
								isOwner={isOwner}
								userDid={userDid}
							/>
						))}
					</div>
				) : (
					<div className="card p-8 text-center">
						<p className="text-(--foreground-muted)">No reviews yet.</p>
					</div>
				)}
			</section>
		</div>
	);
}

function ProfileReviewCard({
	review,
	isOwner,
	userDid,
}: {
	review: UserReviewDto;
	isOwner: boolean;
	userDid: string;
}) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		...reviewsControllerUpsertReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: reviewsControllerGetUserReviewsQueryKey({
					path: { userDid },
					query: { limit: 4 },
				}),
			});
			toast.success("Rating updated");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update rating",
			);
		},
	});

	const href =
		review.mediaType === "movie"
			? `/movies/${review.mediaId}/${toSlug(review.title || "")}`
			: `/shows/${review.mediaId}/${toSlug(review.title || "")}`;

	const handleRatingChange = (newRating: number) => {
		if (!isOwner) return;
		mutation.mutate({
			body: {
				mediaType: review.mediaType,
				mediaId: review.mediaId,
				seasonNumber: review.seasonNumber,
				episodeNumber: review.episodeNumber,
				rating: newRating,
				content: review.content,
			},
		});
	};

	return (
		<div key={review.id} className="card p-4">
			{review.posterPath && (
				<Link to={href}>
					<img
						src={`https://image.tmdb.org/t/p/w300${review.posterPath}`}
						alt={review.title || "Poster"}
						className="mb-2 aspect-[2/3] w-full rounded-md object-cover"
					/>
				</Link>
			)}
			<h3 className="line-clamp-2 font-medium text-sm">
				{review.title || "Unknown"}
			</h3>
			<StarRating
				value={review.rating}
				onChange={isOwner ? handleRatingChange : undefined}
				readOnly={!isOwner}
				size="sm"
				showValue
			/>
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
											? `/shows/${mediaId}/${toSlug(title)}/seasons/${item.seasonNumber}/episodes/${item.episodeNumber}`
											: item.mediaType === "movie"
												? `/movies/${mediaId}/${toSlug(title)}`
												: `/shows/${mediaId}/${toSlug(title)}`
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
