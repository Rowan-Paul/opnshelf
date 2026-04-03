import {
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	type UpNextShowDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Tv2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import { getProfileRoute } from "@/lib/profile-routes";
import { createTitleSlug, formatDateOnly, getTmdbPosterUrl } from "@/lib/utils";

export interface UpNextShowCollectionProps {
	isFetching: boolean;
	isLoading: boolean;
	upNext: UpNextShowDto[];
	userDid: string;
	profileHandle?: string;
	limit?: number;
	readOnly?: boolean;
	showHeader?: boolean;
	variant: "dashboard" | "profile";
}

export function UpNextShowCollection({
	isFetching,
	isLoading,
	upNext,
	userDid,
	profileHandle,
	limit,
	readOnly = false,
	showHeader = true,
	variant,
}: UpNextShowCollectionProps) {
	const queryClient = useQueryClient();
	const markMutation = useMutation({
		mutationKey: ["shows", "episodes", "markWatched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, userDid);
			invalidateUserUpNextQueries(queryClient, userDid);
			toast.success("Episode marked watched");
		},
		onError: () => {
			toast.error("Failed to mark episode watched");
		},
	});

	const items = typeof limit === "number" ? upNext.slice(0, limit) : upNext;
	const isProfile = variant === "profile";
	const isRefreshing = isFetching && !isLoading && items.length > 0;
	const skeletonCount = isProfile ? 6 : 4;
	const skeletonIds = Array.from(
		{ length: skeletonCount },
		(_, index) => `up-next-skeleton-${variant}-${index + 1}`,
	);
	const cardMinHeight = isProfile ? "min-h-[240px]" : "min-h-[220px]";

	return (
		<div>
			{showHeader ? (
				<div className="mb-4 flex items-center justify-between gap-3">
					<div>
						<h2 className="md-headline-small">Up Next</h2>
						<p
							className="text-sm"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							Pick up exactly where you left off.
						</p>
					</div>
					{profileHandle ? (
						<M3Button variant="text" className="rounded-full px-4" asChild>
							<Link {...getProfileRoute(profileHandle, "up-next", { page: 1 })}>
								View all
							</Link>
						</M3Button>
					) : null}
				</div>
			) : null}

			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
					{skeletonIds.map((skeletonId) => (
						<M3Card
							key={skeletonId}
							variant="filled"
							className="h-full overflow-hidden"
						>
							<div className={`flex items-stretch gap-4 p-4 ${cardMinHeight}`}>
								<div className="w-24 shrink-0 self-center">
									<Skeleton className="aspect-2/3 w-full rounded-xl bg-(--md-sys-color-surface-container-highest)" />
									<div className="mt-1.5 h-1 w-1/2 overflow-hidden rounded-full bg-(--md-sys-color-surface-container-highest)">
										<div className="h-full w-full bg-(--md-sys-color-primary)/40" />
									</div>
								</div>
								<div className="flex min-w-0 flex-1 flex-col justify-between">
									<div>
										<div className="mb-4 flex flex-wrap items-center gap-1.5">
											<Skeleton className="h-6 w-18 rounded-full bg-(--md-sys-color-surface-container-highest)" />
											<Skeleton className="h-6 w-20 rounded-full bg-(--md-sys-color-surface-container-highest)" />
										</div>
										<Skeleton className="h-8 w-4/5 rounded-lg bg-(--md-sys-color-surface-container-highest)" />
										<Skeleton className="mt-3 h-6 w-3/5 rounded-lg bg-(--md-sys-color-surface-container-highest)" />
										{isProfile ? (
											<div className="space-y-2 pt-5">
												<Skeleton className="h-4 w-32 rounded bg-(--md-sys-color-surface-container-highest)" />
												<Skeleton className="h-4 w-28 rounded bg-(--md-sys-color-surface-container-highest)" />
											</div>
										) : null}
									</div>
									<div className="flex justify-end pt-4">
										<Skeleton className="h-9 w-24 rounded-full bg-(--md-sys-color-surface-container-highest)" />
									</div>
								</div>
							</div>
						</M3Card>
					))}
				</div>
			) : items.length > 0 ? (
				<div
					aria-busy={isRefreshing || undefined}
					className={`grid grid-cols-1 gap-4 transition-opacity duration-200 xl:grid-cols-2 ${
						isRefreshing ? "pointer-events-none" : ""
					}`}
					style={{ opacity: isRefreshing ? 0.58 : 1 }}
				>
					{items.map((item) => {
						const posterUrl = getTmdbPosterUrl(item.show.posterPath, "w500");
						const isPending =
							markMutation.isPending &&
							markMutation.variables?.body?.showId === item.showId &&
							markMutation.variables?.body?.seasonNumber ===
								item.nextEpisode.seasonNumber &&
							markMutation.variables?.body?.episodeNumber ===
								item.nextEpisode.episodeNumber;

						return (
							<Link
								key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
								to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
								params={{
									showId: item.showId,
									title: createTitleSlug(item.show.title),
									seasonNumber: String(item.nextEpisode.seasonNumber),
									episodeNumber: String(item.nextEpisode.episodeNumber),
								}}
							>
								<M3Card
									variant="filled"
									className="h-full overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
								>
									<div
										className={`flex gap-4 p-4 items-stretch ${cardMinHeight}`}
									>
										<div className="w-24 shrink-0 self-center">
											<div className="aspect-2/3 w-full overflow-hidden rounded-xl bg-(--md-sys-color-surface-container)">
												{posterUrl ? (
													<img
														src={posterUrl}
														alt={item.show.title}
														className="h-full w-full object-cover"
														loading="lazy"
													/>
												) : (
													<div className="flex h-full w-full items-center justify-center text-sm text-(--md-sys-color-on-surface-variant)">
														No poster
													</div>
												)}
											</div>
											{item.totalEpisodes > 0 ? (
												<div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-(--md-sys-color-primary)/20">
													<div
														className="h-full rounded-full transition-all duration-300"
														style={{
															width: `${Math.min(Math.round((item.episodesWatched / item.totalEpisodes) * 100), 100)}%`,
															backgroundColor: "var(--md-sys-color-primary)",
														}}
													/>
												</div>
											) : null}
										</div>
										<div className="flex min-w-0 flex-1 flex-col justify-between">
											<div>
												<M3CardHeader className="p-0 pb-2">
													<div className="mb-2 flex flex-wrap items-center gap-1.5">
														<Badge variant="default">Up next</Badge>
														<Badge variant="outline">
															S{item.nextEpisode.seasonNumber} E
															{item.nextEpisode.episodeNumber}
														</Badge>
													</div>
													<M3CardTitle className="text-[1.7rem] leading-[1.1] tracking-tight">
														{item.show.title}
													</M3CardTitle>
													<M3CardDescription className="mt-1 text-xl leading-tight line-clamp-2">
														{item.nextEpisode.name}
													</M3CardDescription>
												</M3CardHeader>

												{isProfile ? (
													<div
														className="space-y-2 pt-3 text-sm"
														style={{
															color: "var(--md-sys-color-on-surface-variant)",
														}}
													>
														<p>
															Last watched S{item.lastWatched.seasonNumber} E
															{item.lastWatched.episodeNumber}
														</p>
														{item.nextEpisode.airDate ? (
															<p>
																Aired {formatDateOnly(item.nextEpisode.airDate)}
															</p>
														) : null}
													</div>
												) : null}
											</div>

											{readOnly ? null : (
												<M3CardContent className="flex justify-end p-0 pt-4">
													<div className="shrink-0 self-end">
														<M3Button
															size="sm"
															variant="filled-tonal"
															disabled={isPending}
															onClick={(event) => {
																event.preventDefault();
																event.stopPropagation();
																markMutation.mutate({
																	body: {
																		showId: item.showId,
																		seasonNumber: item.nextEpisode.seasonNumber,
																		episodeNumber:
																			item.nextEpisode.episodeNumber,
																	},
																});
															}}
														>
															{isPending ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<Check className="h-4 w-4" />
															)}
															Watch
														</M3Button>
													</div>
												</M3CardContent>
											)}
										</div>
									</div>
								</M3Card>
							</Link>
						);
					})}
				</div>
			) : (
				<M3Card variant="elevated">
					<M3CardHeader>
						<div className="mb-3 flex items-center gap-3">
							<div className="rounded-full bg-(--md-sys-color-primary-container) p-2">
								<Tv2 className="h-5 w-5 text-(--md-sys-color-primary)" />
							</div>
						</div>
						<M3CardTitle>Nothing queued up yet</M3CardTitle>
						<M3CardDescription>
							Watch a few episodes and OpnShelf will line up what comes next.
						</M3CardDescription>
					</M3CardHeader>
					{isProfile ? (
						<M3CardContent>
							<M3Button variant="filled" asChild>
								<Link to="/search" search={{ q: "", type: "all" }}>
									Search for shows
								</Link>
							</M3Button>
						</M3CardContent>
					) : null}
				</M3Card>
			)}
		</div>
	);
}
