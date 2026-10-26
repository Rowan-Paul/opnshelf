import {
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListsOptions,
	shelfControllerGetUserShelfOptions,
	slugifyName,
	type UserReviewDto,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import ActionableMediaCard from "#/components/ActionableMediaCard";
import { ProfileContentCard } from "#/components/ProfileContentCard";
import { PrivateNotice } from "#/components/profile/PrivateNotice";
import { ReviewAuthorRating } from "#/components/ReviewAuthorRating";
import { ReviewBody } from "#/components/ReviewBody";
import { SpoilerShield } from "#/components/SpoilerShield";
import { StatsStrip } from "#/components/StatsStrip";
import { useAuth } from "#/lib/auth-context";
import { useUserReviews } from "#/lib/hooks/useReviews";
import { ShowProgressScope } from "#/lib/hooks/useShowProgress";
import { getPageMeta, getSharingImageUrl } from "#/lib/media-meta";

// Horizontally-scrolling preview row (Recent Movies/Episodes, list previews).
const SCROLL_ROW =
	"flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const SCROLL_SKELETON =
	"aspect-[2/3] w-[160px] shrink-0 animate-pulse rounded-lg bg-(--background-subtle) sm:w-[180px]";
// Both Recent rows use 16:9 backdrops so the two columns line up.
const BACKDROP_SKELETON =
	"aspect-video w-[260px] shrink-0 animate-pulse rounded-lg bg-(--background-subtle) sm:w-[300px]";

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
	head: ({ loaderData, match }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: getPageMeta(
				{
					title: `${name}'s Profile | Opnshelf`,
					description: `View ${name}'s profile on Opnshelf.`,
					imageUrl: loaderData?.profile
						? getSharingImageUrl({
								handle: loaderData.profile.handle,
								view: "profile",
							})
						: undefined,
				},
				match.pathname,
			),
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
	const canReadWatches = isOwner || profile?.watchesPublic === true;

	// Both preview rows read the shelf endpoint rather than the dedicated
	// recent-movies/episodes ones: it's the source that carries the profile
	// owner's Watch counts (and episode titles), so these posters badge the same
	// way as the Shelf page and the Mobile Overview tab.
	const { data: moviesData, isLoading: moviesLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { page: 1, pageSize: 8, type: "movie", sortOrder: "desc" },
		}),
		enabled: !!userDid && canReadWatches,
	});

	const { data: episodesData, isLoading: episodesLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { page: 1, pageSize: 8, type: "episode", sortOrder: "desc" },
		}),
		enabled: !!userDid && canReadWatches,
	});

	const movies = (moviesData?.items ?? []).filter(
		(item) => item.type === "movie",
	);
	const episodes = (episodesData?.items ?? []).filter(
		(item) => item.type === "episode",
	);

	// Fetch public lists
	const { data: listsData } = useQuery({
		...listsControllerGetPublicUserListsOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	const { data: reviewsData, isLoading: reviewsLoading } = useUserReviews({
		userDid,
		pageSize: 4,
	});

	const watchlist = listsData?.find((l) => l.slug === "watchlist");
	const favorites = listsData?.find((l) => l.slug === "favorites");

	return (
		<div className="space-y-10">
			{canReadWatches ? (
				<>
					{/* Stats strip: 30-day activity graph + a few headline stats */}
					<StatsStrip
						activity={profile?.activityLast30Days}
						mostWatchedShow={profile?.mostWatchedShow ?? null}
						watchedThisMonth={profile?.watchedThisMonth ?? 0}
						watchStreak={profile?.watchStreak ?? 0}
						reviewsCount={profile?.reviewsCount ?? 0}
						isLoading={!profile && !!handle}
					/>

					{/* Last Movies & Episodes */}
					<div className="grid gap-8 lg:grid-cols-2">
						{/* Last Movies */}
						<section className="min-w-0">
							<div className="mb-4 flex items-center justify-between">
								<h2 className="text-display-3">Recent Movies</h2>
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
									{[1, 2, 3].map((i) => (
										<div key={i} className={BACKDROP_SKELETON} />
									))}
								</div>
							) : movies.length > 0 ? (
								<div className={SCROLL_ROW}>
									{movies.map((item) => (
										<div
											key={item.id}
											className="w-[260px] shrink-0 sm:w-[300px]"
										>
											<ActionableMediaCard
												id={item.movieId}
												title={item.title}
												posterUrl={
													item.posterPath
														? `https://image.tmdb.org/t/p/w500${item.posterPath}`
														: ""
												}
												backdropUrl={
													item.backdropPath
														? `https://image.tmdb.org/t/p/w780${item.backdropPath}`
														: undefined
												}
												layout="backdrop"
												type="movie"
												watchedDate={item.watchedDate}
												undatedWatch={!item.watchedDate}
												interactive={isOwner}
												isWatched={true}
												watchCount={item.watchCount}
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
								<h2 className="text-display-3">Recent Episodes</h2>
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
									{[1, 2, 3].map((i) => (
										<div key={i} className={BACKDROP_SKELETON} />
									))}
								</div>
							) : episodes.length > 0 ? (
								<div className={SCROLL_ROW}>
									{episodes.map((item) => (
										// Episode stills, like Home's Your Shelf: the show poster
										// repeated once per episode read as one item duplicated.
										<div
											key={item.id}
											className="w-[260px] shrink-0 sm:w-[300px]"
										>
											<ActionableMediaCard
												id={item.showId}
												title={item.showTitle}
												posterUrl={
													item.posterPath
														? `https://image.tmdb.org/t/p/w500${item.posterPath}`
														: ""
												}
												backdropUrl={
													item.stillPath
														? `https://image.tmdb.org/t/p/w780${item.stillPath}`
														: item.backdropPath
															? `https://image.tmdb.org/t/p/w780${item.backdropPath}`
															: undefined
												}
												layout="backdrop"
												type="show"
												seasonNumber={item.seasonNumber}
												episodeNumber={item.episodeNumber}
												episodeInfo={
													item.episodeTitle
														? `S${item.seasonNumber}E${item.episodeNumber} — ${item.episodeTitle}`
														: `S${item.seasonNumber}E${item.episodeNumber}`
												}
												watchedDate={item.watchedDate}
												undatedWatch={!item.watchedDate}
												interactive={isOwner}
												isWatched={true}
												watchCount={item.watchCount}
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
				</>
			) : profile ? (
				<PrivateNotice message="Watches are private." />
			) : null}
			{/* Lists Preview */}
			<div className="grid gap-8 lg:grid-cols-2">
				<ListPreview
					title="Watchlist"
					list={watchlist}
					handle={handle}
					userDid={userDid}
					isOwner={isOwner}
					emptyText="Nothing on watchlist"
				/>
				<ListPreview
					title="Favorites"
					list={favorites}
					handle={handle}
					userDid={userDid}
					isOwner={isOwner}
					emptyText="Nothing on favorites"
				/>
			</div>

			{/* Recent Reviews */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-display-3">Recent Reviews</h2>
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
	const showName = review.mediaTitle ?? "";
	const slug = slugifyName(showName);

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
			title={review.mediaLabel || "Unknown"}
			meta={review.reviewTitle}
		>
			<ReviewAuthorRating rating={review.authorRating} />
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
	emptyText,
}: {
	title: string;
	list?: { slug: string; itemCount: number };
	handle: string;
	userDid: string;
	isOwner: boolean;
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
				<h2 className="text-display-3">{title}</h2>
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
				<ShowProgressScope
					showIds={items
						.filter(
							(item) =>
								item.mediaType === "show" &&
								item.seasonNumber == null &&
								item.episodeNumber == null,
						)
						.map((item) => item.mediaId)}
				>
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
										watchCount={item.watchCount}
									/>
								</div>
							);
						})}
					</div>
				</ShowProgressScope>
			) : (
				<div className="card p-6 text-center">
					<p className="text-(--foreground-muted)">{emptyText}</p>
				</div>
			)}
		</section>
	);
}
