import {
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListsOptions,
	moviesControllerGetUserMoviesPaginatedOptions,
	showsControllerGetUserEpisodesPaginatedOptions,
	type UserReviewDto,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Film, Heart, Star, Tv } from "lucide-react";
import ActionableMediaCard from "#/components/ActionableMediaCard";
import { ProfileContentCard } from "#/components/ProfileContentCard";
import { ReviewBody } from "#/components/ReviewBody";
import { SpoilerShield } from "#/components/SpoilerShield";
import { StatsStrip } from "#/components/StatsStrip";
import { useAuth } from "#/lib/auth-context";
import { useUserReviews } from "#/lib/hooks/useReviews";
import { toSlug } from "#/lib/slug";

// Horizontally-scrolling preview row (Recent Movies/Episodes, list previews).
const SCROLL_ROW =
	"flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const SCROLL_SKELETON =
	"aspect-[2/3] w-[160px] shrink-0 animate-pulse rounded-lg bg-(--background-subtle) sm:w-[180px]";

export const Route = createFileRoute("/profile/$handle/")({
	loader: async ({ context, params }) => {
		try {
			const profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
			return { profile };
		} catch {
			return { profile: null };
		}
	},
	head: ({ loaderData }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: [{ title: `${name}'s Profile | Opnshelf` }],
		};
	},
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
	const { data: listsData } = useQuery({
		...listsControllerGetPublicUserListsOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	const { data: reviewsData, isLoading: reviewsLoading } = useUserReviews({
		userDid,
		limit: 4,
	});

	const watchlist = listsData?.find((l) => l.slug === "watchlist");
	const favorites = listsData?.find((l) => l.slug === "favorites");

	return (
		<div className="space-y-10">
			{/* Stats strip: 30-day activity graph + a few headline stats */}
			<StatsStrip
				activity={profile?.activityLast30Days}
				mostWatchedShow={profile?.mostWatchedShow ?? null}
				watchedThisYear={profile?.watchedThisYear ?? 0}
				reviewsCount={profile?.reviewsCount ?? 0}
				isLoading={!profile && !!handle}
			/>

			{/* Last Movies & Episodes */}
			<div className="grid gap-8 lg:grid-cols-2">
				{/* Last Movies */}
				<section className="min-w-0">
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
						<div className={SCROLL_ROW}>
							{[1, 2, 3, 4].map((i) => (
								<div key={i} className={SCROLL_SKELETON} />
							))}
						</div>
					) : movies.length > 0 ? (
						<div className={SCROLL_ROW}>
							{movies.map((item) => (
								<div key={item.id} className="shrink-0">
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
				<section className="min-w-0">
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
						<div className={SCROLL_ROW}>
							{[1, 2, 3, 4].map((i) => (
								<div key={i} className={SCROLL_SKELETON} />
							))}
						</div>
					) : episodes.length > 0 ? (
						<div className={SCROLL_ROW}>
							{episodes.map((item) => (
								<div key={item.id} className="shrink-0">
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
					isOwner={isOwner}
					icon={Clock}
					emptyText="Nothing on watchlist"
				/>
				<ListPreview
					title="Favorites"
					list={favorites}
					handle={handle}
					userDid={userDid}
					isOwner={isOwner}
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
					<div className="grid gap-4 sm:grid-cols-2">
						{[1, 2].map((i) => (
							<div
								key={i}
								className="card h-28 animate-pulse bg-(--background-subtle)"
							/>
						))}
					</div>
				) : reviewsData?.items && reviewsData.items.length > 0 ? (
					<div className="grid gap-4 sm:grid-cols-2">
						{reviewsData.items.map((review) => (
							<ProfileReviewCard
								key={review.id}
								review={review}
								authorDid={userDid}
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
	authorDid,
}: {
	review: UserReviewDto;
	authorDid: string;
}) {
	const showName = review.title?.split(" — ")[0] ?? "";
	const slug = toSlug(showName);

	const href = (() => {
		if (review.mediaType === "movie") {
			return `/movies/${review.mediaId}/${slug}`;
		}
		if (review.mediaType === "show") {
			return `/shows/${review.mediaId}/${slug}`;
		}
		if (review.mediaType === "season") {
			return `/shows/${review.mediaId}/${slug}/seasons/${review.seasonNumber}`;
		}
		if (review.mediaType === "episode") {
			return `/shows/${review.mediaId}/${slug}/seasons/${review.seasonNumber}/episodes/${review.episodeNumber}`;
		}
		return "#";
	})();

	// Media title on top (like mobile / the Reviews tab), review title as meta.
	return (
		<ProfileContentCard
			posterUrl={
				review.posterPath
					? `https://image.tmdb.org/t/p/w300${review.posterPath}`
					: null
			}
			to={href}
			hash={`review-${review.id}`}
			title={review.title || "Unknown"}
			meta={review.reviewTitle}
		>
			{review.markdown && (
				<div className="text-(--foreground-muted) text-sm leading-relaxed">
					{/* The whole card links to the review, so "Read more" is a cue. */}
					<SpoilerShield spoiler={review.spoiler} authorDid={authorDid}>
						<ReviewBody markdown={review.markdown} />
					</SpoilerShield>
				</div>
			)}
		</ProfileContentCard>
	);
}

function ListPreview({
	title,
	list,
	handle,
	userDid,
	isOwner,
	icon: Icon,
	emptyText,
}: {
	title: string;
	list?: { slug: string; itemCount: number };
	handle: string;
	userDid: string;
	isOwner: boolean;
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
		<section className="min-w-0">
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
				<div className={SCROLL_ROW}>
					{[1, 2, 3].map((i) => (
						<div key={i} className={SCROLL_SKELETON} />
					))}
				</div>
			) : items.length > 0 ? (
				<div className={SCROLL_ROW}>
					{items.map((item) => {
						const media = item.media as Record<string, unknown>;
						const posterPath = media.posterPath as string | undefined;
						const title = (media.title as string) || "Unknown";
						const mediaId = (media.mediaId as string) || item.mediaId;
						const isEpisode =
							item.seasonNumber != null && item.episodeNumber != null;

						return (
							<div key={item.id} className="shrink-0">
								<ActionableMediaCard
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
									interactive={isOwner}
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
