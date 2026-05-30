import {
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListsOptions,
	type MostWatchedShowDto,
	moviesControllerGetUserMoviesPaginatedOptions,
	type ProfileActivityDayDto,
	showsControllerGetUserEpisodesPaginatedOptions,
	type UserReviewDto,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Film, Heart, Star, Tv } from "lucide-react";
import ActionableMediaCard from "#/components/ActionableMediaCard";
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
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
							/>
						))}
					</div>
				) : reviewsData?.items && reviewsData.items.length > 0 ? (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
						{reviewsData.items.map((review) => (
							<ProfileReviewCard key={review.id} review={review} />
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

function ProfileReviewCard({ review }: { review: UserReviewDto }) {
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

	return (
		<Link to={href} key={review.id} className="block">
			{review.posterPath && (
				<img
					src={`https://image.tmdb.org/t/p/w300${review.posterPath}`}
					alt={review.title || "Poster"}
					className="mb-2 aspect-[2/3] w-full rounded-md object-cover"
				/>
			)}
			<h3 className="line-clamp-2 font-medium text-sm">
				{review.title || "Unknown"}
			</h3>
			<p className="line-clamp-1 text-(--foreground-muted) text-xs">
				{review.reviewTitle}
			</p>
		</Link>
	);
}

function StatsStrip({
	activity,
	mostWatchedShow,
	watchedThisYear,
	reviewsCount,
	isLoading,
}: {
	activity?: ProfileActivityDayDto[];
	mostWatchedShow: MostWatchedShowDto | null;
	watchedThisYear: number;
	reviewsCount: number;
	isLoading: boolean;
}) {
	if (isLoading) {
		return <div className="card h-32 animate-pulse" />;
	}

	const days = activity ?? [];
	const last30Total = days.reduce((sum, d) => sum + d.count, 0);

	return (
		<div className="card flex flex-col gap-6 p-5 lg:flex-row">
			{/* Activity graph */}
			<div className="min-w-0 flex-1">
				<div className="mb-3 flex items-baseline justify-between">
					<h2 className="flex items-center gap-2 font-medium text-(--foreground-muted) text-sm">
						<Clock className="size-4 text-(--accent)" />
						Last 30 days
					</h2>
					<span className="text-(--foreground-muted) text-xs">
						{last30Total} watched
					</span>
				</div>
				<ActivityGraph data={days} />
			</div>

			{/* Headline stats */}
			<div className="flex items-center gap-6 lg:gap-8 lg:border-(--border) lg:border-l lg:pl-8">
				{mostWatchedShow && <MostWatchedShowStat show={mostWatchedShow} />}
				<NumberStat label="This year" value={watchedThisYear} />
				<NumberStat label="Reviews" value={reviewsCount} />
			</div>
		</div>
	);
}

function ActivityGraph({ data }: { data: ProfileActivityDayDto[] }) {
	const max = Math.max(1, ...data.map((d) => d.count));

	return (
		<div className="flex h-20 items-end gap-[3px]">
			{data.map((d) => {
				const pct = (d.count / max) * 100;
				return (
					<div
						key={d.date}
						title={`${d.date} — ${d.count} watched`}
						className={`flex-1 rounded-sm ${
							d.count > 0 ? "bg-(--accent)" : "bg-(--background-subtle)"
						}`}
						style={{ height: d.count > 0 ? `${Math.max(12, pct)}%` : "3px" }}
					/>
				);
			})}
		</div>
	);
}

function NumberStat({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex flex-col justify-center">
			<p className="font-semibold text-2xl tabular-nums">{value}</p>
			<p className="text-(--foreground-muted) text-xs">{label}</p>
		</div>
	);
}

function MostWatchedShowStat({ show }: { show: MostWatchedShowDto }) {
	return (
		<Link
			to="/shows/$showId/$showName"
			params={{ showId: show.showId, showName: toSlug(show.title) }}
			className="flex items-center gap-3"
		>
			{show.posterPath ? (
				<img
					src={`https://image.tmdb.org/t/p/w200${show.posterPath}`}
					alt={show.title}
					className="h-14 w-10 shrink-0 rounded object-cover"
				/>
			) : (
				<div className="h-14 w-10 shrink-0 rounded bg-(--background-subtle)" />
			)}
			<div className="min-w-0">
				<p className="text-(--foreground-muted) text-xs">Most watched</p>
				<p className="line-clamp-1 font-semibold text-sm">{show.title}</p>
				<p className="text-(--foreground-muted) text-xs">
					{show.episodeWatchCount} episodes
				</p>
			</div>
		</Link>
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
