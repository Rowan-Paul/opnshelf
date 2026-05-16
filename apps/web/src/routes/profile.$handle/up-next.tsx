import {
	showsControllerGetUserUpNextOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { Calendar, Loader2, Plus, Tv } from "lucide-react";
import { z } from "zod";
import { Pagination } from "#/components/Pagination";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { formatDate } from "#/lib/date-utils";
import { useMarkEpisodeWatched } from "#/lib/hooks";
import { toSlug } from "#/lib/slug";

setupApiClient();

const searchSchema = z.object({
	page: z.coerce.number().min(1).optional().default(1),
});

export const Route = createFileRoute("/profile/$handle/up-next")({
	component: ProfileUpNextPage,
	validateSearch: searchSchema,
});

function formatRelativeDate(dateStr: string): string {
	const releaseDate = new Date(dateStr);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	releaseDate.setHours(0, 0, 0, 0);

	const diffTime = releaseDate.getTime() - today.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Tomorrow";
	if (diffDays > 0 && diffDays < 7) return `in ${diffDays} days`;
	if (diffDays > 0 && diffDays < 30)
		return `in ${Math.ceil(diffDays / 7)} weeks`;
	if (diffDays > 0) return formatDate(dateStr);
	if (diffDays === -1) return "Yesterday";
	if (diffDays > -7) return `${Math.abs(diffDays)} days ago`;
	if (diffDays > -30) return `${Math.ceil(Math.abs(diffDays) / 7)} weeks ago`;
	return formatDate(dateStr);
}

function ProfileUpNextPage() {
	const { handle } = Route.useParams();
	const search = useSearch({ from: Route.id });
	const navigate = useNavigate();
	const { user } = useAuth();
	const page = search.page;

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const isOwner = user?.did === userDid;

	const { data, isLoading } = useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid },
			query: { page, pageSize: 20 },
		}),
		enabled: !!userDid,
	});

	const markEpisodeMutation = useMarkEpisodeWatched();

	const items = data?.items ?? [];

	const handlePageChange = (newPage: number) => {
		navigate({
			to: "/profile/$handle/up-next",
			params: { handle },
			search: newPage > 1 ? { page: newPage } : undefined,
			replace: true,
		});
	};

	return (
		<div className="space-y-6">
			<h1 className="text-display-2">Up Next</h1>

			{isLoading ? (
				<div className="space-y-4">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="card animate-pulse p-4">
							<div className="flex gap-4">
								<div className="h-24 w-16 rounded-md bg-(--background-subtle)" />
								<div className="flex-1 space-y-2">
									<div className="h-4 w-1/3 rounded bg-(--background-subtle)" />
									<div className="h-3 w-1/4 rounded bg-(--background-subtle)" />
									<div className="h-3 w-1/2 rounded bg-(--background-subtle)" />
								</div>
							</div>
						</div>
					))}
				</div>
			) : items.length === 0 ? (
				<div className="card p-8 text-center">
					<Tv className="mx-auto mb-3 size-12 text-(--foreground-muted)" />
					<p className="text-(--foreground-muted)">All caught up!</p>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						No upcoming episodes to watch.
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{items.map((item) => {
						const show = item.show;
						const nextEp = item.nextEpisode;
						const progress =
							item.totalEpisodes > 0
								? Math.round((item.episodesWatched / item.totalEpisodes) * 100)
								: 0;

						return (
							<div
								key={`${item.showId}-${nextEp.seasonNumber}-${nextEp.episodeNumber}`}
								className="card flex flex-col gap-4 p-4 sm:flex-row"
							>
								{/* Poster */}
								<Link
									to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
									params={{
										showId: item.showId,
										showName: toSlug(show.title),
										seasonNumber: String(nextEp.seasonNumber),
										episodeNumber: String(nextEp.episodeNumber),
									}}
									className="shrink-0"
								>
									<div className="h-32 w-22 overflow-hidden rounded-lg bg-(--background-subtle) sm:h-36 sm:w-24">
										{show.posterPath ? (
											<img
												src={`https://image.tmdb.org/t/p/w500${show.posterPath}`}
												alt={show.title}
												className="h-full w-full object-cover"
												loading="lazy"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center">
												<Tv className="size-8 text-(--foreground-muted)" />
											</div>
										)}
									</div>
								</Link>

								{/* Info */}
								<div className="flex min-w-0 flex-1 flex-col justify-between">
									<div>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<Link
													to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
													params={{
														showId: item.showId,
														showName: toSlug(show.title),
														seasonNumber: String(nextEp.seasonNumber),
														episodeNumber: String(nextEp.episodeNumber),
													}}
													className="font-semibold hover:text-(--accent)"
												>
													{show.title}
												</Link>
												<p className="mt-0.5 font-medium text-sm">
													{nextEp.name || `Episode ${nextEp.episodeNumber}`}
												</p>
											</div>
											<span className="badge badge-accent shrink-0 text-xs">
												S{nextEp.seasonNumber}E{nextEp.episodeNumber}
											</span>
										</div>

										{nextEp.airDate && (
											<div className="mt-2 flex items-center gap-2 text-(--foreground-muted) text-sm">
												<Calendar className="size-4" />
												<span>{formatDate(nextEp.airDate)}</span>
												{new Date(nextEp.airDate) >=
												new Date(new Date().setHours(0, 0, 0, 0)) ? (
													<span className="text-(--accent)">
														• {formatRelativeDate(nextEp.airDate)}
													</span>
												) : item.latestWatchedDate ? (
													<span className="text-xs">
														Last watched: {formatDate(item.latestWatchedDate)}
													</span>
												) : null}
											</div>
										)}

										{nextEp.overview && (
											<p className="mt-2 line-clamp-2 text-(--foreground-muted) text-sm">
												{nextEp.overview}
											</p>
										)}
									</div>

									{/* Progress + Action */}
									<div className="mt-3 flex items-center gap-4">
										<div className="flex min-w-0 flex-1 items-center gap-2">
											<div className="h-2 flex-1 overflow-hidden rounded-full bg-(--background-subtle)">
												<div
													className="h-full rounded-full bg-(--accent) transition-all"
													style={{
														width: `${progress}%`,
													}}
												/>
											</div>
											<span className="shrink-0 text-(--foreground-muted) text-xs">
												{item.episodesWatched} / {item.totalEpisodes}
											</span>
										</div>

										{isOwner && (
											<button
												type="button"
												onClick={() =>
													markEpisodeMutation.mutate({
														body: {
															showId: item.showId,
															seasonNumber: nextEp.seasonNumber,
															episodeNumber: nextEp.episodeNumber,
														},
													})
												}
												disabled={markEpisodeMutation.isPending}
												className="btn btn-primary gap-2 text-sm"
											>
												{markEpisodeMutation.isPending ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<Plus className="size-4" />
												)}
												Add to shelf
											</button>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Pagination */}
			{data && data.totalPages > 1 && (
				<div className="flex justify-center pt-4">
					<Pagination
						page={data.page}
						totalPages={data.totalPages}
						onPageChange={handlePageChange}
					/>
				</div>
			)}
		</div>
	);
}
