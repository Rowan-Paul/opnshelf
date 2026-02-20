import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	Calendar,
	Check,
	CircleDot,
	Eye,
	Film,
	History,
	Layers,
	ListPlus,
	RotateCcw,
	Share2,
	Star,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddToListModal } from "@/components/AddToListModal";
import { AddToShelfButton } from "@/components/AddToShelfButton";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
import { DatePickerModal } from "@/components/DatePickerModal";
import { ActionButton } from "@/components/ui/action-button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { M3Button } from "@/components/ui/m3-button";
import {
	formatDateOnly,
	formatDateWithTimezone,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
} from "@/lib/utils";

export const Route = createFileRoute(
	"/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber",
)({
	loader: async ({ params, context }) => {
		const { showId, seasonNumber, episodeNumber } = params;
		const { queryClient } = context;

		const showData = await queryClient.fetchQuery({
			...showsControllerGetShowDetailsOptions({
				path: { showId },
			}),
		});

		const episodeData = await queryClient.fetchQuery({
			...showsControllerGetEpisodeDetailsOptions({
				path: { showId, seasonNumber, episodeNumber },
			}),
		});

		return { show: showData, episode: episodeData };
	},
	head: ({ loaderData }) => {
		const showName = loaderData?.show?.name;
		const episodeName = loaderData?.episode?.name;
		const title =
			showName && episodeName
				? `${showName}: ${episodeName} | OpnShelf`
				: "Episode | OpnShelf";

		return {
			meta: [{ title }],
		};
	},
	component: ShowEpisodePage,
});

function ShowEpisodePage() {
	const { showId, title, seasonNumber, episodeNumber } = Route.useParams();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [showDateModal, setShowDateModal] = useState(false);
	const [showListModal, setShowListModal] = useState(false);
	const [showHistoryDialog, setShowHistoryDialog] = useState(false);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const resolvedUserDid = user?.did || "";

	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId },
		}),
	});

	const { data: episode } = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId, seasonNumber, episodeNumber },
		}),
	});

	const { data: season } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId, seasonNumber },
		}),
	});

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: resolvedUserDid, showId },
		}),
		enabled: !!resolvedUserDid,
	});
	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	const { data: listsForShow } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: showId },
		}),
		enabled: !!user?.did,
	});

	const watchedCountForEpisode =
		history?.filter(
			(h) =>
				h.seasonNumber === Number(seasonNumber) &&
				h.episodeNumber === Number(episodeNumber),
		).length || 0;
	const isWatchedEpisode = watchedCountForEpisode > 0;
	const latestEpisodeWatch = useMemo(() => {
		if (!history?.length) return null;
		return (
			history
				.filter(
					(h) =>
						h.seasonNumber === Number(seasonNumber) &&
						h.episodeNumber === Number(episodeNumber),
				)
				.sort(
					(a, b) =>
						new Date(b.watchedDate).getTime() -
						new Date(a.watchedDate).getTime(),
				)[0] ?? null
		);
	}, [history, seasonNumber, episodeNumber]);
	const episodeWatchHistory = useMemo(() => {
		if (!history?.length) return [];
		return history
			.filter(
				(h) =>
					h.seasonNumber === Number(seasonNumber) &&
					h.episodeNumber === Number(episodeNumber),
			)
			.sort(
				(a, b) =>
					new Date(b.watchedDate).getTime() - new Date(a.watchedDate).getTime(),
			);
	}, [history, seasonNumber, episodeNumber]);
	const listsCount = listsForShow?.filter((l) => l.isInList).length ?? 0;
	const isInAnyList = listsCount > 0;
	const userTimezone = userSettings?.timezone || "UTC";
	const is24Hour = userSettings?.timeFormat === "24h";

	const markMutation = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId },
				}),
			});
			toast.success("Episode marked watched");
		},
		onError: () => {
			toast.error("Failed to mark episode watched");
		},
	});
	const unmarkMutation = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId },
				}),
			});
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf. Please try again.");
		},
	});
	const deleteWatchEntryMutation = useMutation({
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId },
				}),
			});
			toast.success("Watch entry removed");
		},
		onError: () => {
			toast.error("Failed to remove watch entry. Please try again.");
		},
	});

	const colors = showData?.colors || {
		primary: "#F59E0B",
		secondary: "#D97706",
		accent: "#FBBF24",
		muted: "#6b7280",
	};

	const backdropUrl = getTmdbBackdropUrl(showData?.backdrop_path);
	const showPoster = getTmdbPosterUrl(showData?.poster_path, "w500");
	const stillUrl = episode?.still_path
		? `https://image.tmdb.org/t/p/w780${episode.still_path}`
		: null;
	const isPending =
		markMutation.isPending &&
		markMutation.variables?.body?.showId === showId &&
		markMutation.variables?.body?.seasonNumber === Number(seasonNumber) &&
		markMutation.variables?.body?.episodeNumber === Number(episodeNumber);

	const handleMarkWatched = () => {
		markMutation.mutate({
			body: {
				showId,
				seasonNumber: Number(seasonNumber),
				episodeNumber: Number(episodeNumber),
			},
		});
	};
	const handleUnmarkWatched = () => {
		unmarkMutation.mutate({
			path: { showId },
			query: {
				mode: "all",
				seasonNumber,
				episodeNumber,
			},
		});
	};

	const handleShare = async () => {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({ url });
			} catch {
				// User cancelled share
			}
		} else {
			try {
				await navigator.clipboard.writeText(url);
				toast.success("Link copied to clipboard");
			} catch {
				toast.error("Failed to copy link");
			}
		}
	};

	const seasonEpisodeContext = useMemo(() => {
		if (!season?.episodes?.length)
			return { previous: null, current: null, next: null };
		const sortedEpisodes = [...season.episodes].sort(
			(a, b) => a.episode_number - b.episode_number,
		);
		const currentIndex = sortedEpisodes.findIndex(
			(e) => e.episode_number === Number(episodeNumber),
		);
		if (currentIndex < 0) return { previous: null, current: null, next: null };
		return {
			previous: sortedEpisodes[currentIndex - 1] ?? null,
			current: sortedEpisodes[currentIndex] ?? null,
			next: sortedEpisodes[currentIndex + 1] ?? null,
		};
	}, [season?.episodes, episodeNumber]);

	return (
		<div>
			<div className="relative h-[42vh] md:h-[52vh] overflow-hidden">
				{stillUrl || backdropUrl ? (
					<>
						<img
							src={stillUrl || backdropUrl || undefined}
							alt=""
							className="w-full h-full object-cover"
						/>
						<div
							className="absolute inset-0"
							style={{
								background:
									"linear-gradient(to bottom, transparent 0%, rgba(3, 7, 18, 0.7) 62%, rgb(3, 7, 18) 100%)",
							}}
						/>
					</>
				) : (
					<div
						className="w-full h-full"
						style={{
							background: `linear-gradient(135deg, ${colors.muted} 0%, rgb(3, 7, 18) 100%)`,
						}}
					/>
				)}

				<button
					type="button"
					onClick={() => router.history.back()}
					className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors cursor-pointer"
				>
					<ArrowLeft className="w-5 h-5" />
				</button>

				<div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
					<div className="container mx-auto max-w-6xl">
						<div className="flex items-end gap-4 md:gap-8">
							<Link
								to="/shows/$showId/$title"
								params={{ showId, title }}
								className="w-24 md:w-40 rounded-lg overflow-hidden shadow-2xl cursor-pointer transition-transform hover:scale-105"
								style={{ boxShadow: `0 25px 50px -12px ${colors.primary}40` }}
							>
								{showPoster ? (
									<img
										src={showPoster}
										alt={showData?.name}
										className="w-full aspect-2/3 object-cover"
									/>
								) : (
									<div className="w-full aspect-2/3 bg-gray-900 flex items-center justify-center text-gray-600 text-xs">
										No poster
									</div>
								)}
							</Link>
							<div className="pb-2">
								<h1
									className="text-2xl md:text-5xl font-bold mb-2"
									style={{ textShadow: `0 4px 30px ${colors.primary}60` }}
								>
									{showData?.name}
								</h1>
								<h2 className="text-lg md:text-2xl text-gray-200">
									S{seasonNumber} · E{episodeNumber}: {episode?.name}
								</h2>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="container mx-auto px-4 py-6 max-w-6xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
					<div className="space-y-4 min-w-0">
						{user ? (
							!isWatchedEpisode ? (
								<div className="space-y-3">
									<div className="flex gap-2">
										<AddToShelfButton
											onClick={handleMarkWatched}
											isPending={isPending}
											label="Add to Shelf"
											icon={<Calendar className="w-5 h-5" />}
											colors={colors}
											className="flex-1"
										/>
										<button
											type="button"
											onClick={() => setShowDateModal(true)}
											title="Watch episode"
											className="p-3 rounded-xl border transition-all duration-200 flex items-center justify-center group"
											style={{
												backgroundColor: "transparent",
												borderColor: "var(--md-sys-color-outline)",
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.backgroundColor =
													"var(--md-sys-color-surface-container)";
												e.currentTarget.style.borderColor =
													"var(--md-sys-color-primary)";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.backgroundColor = "transparent";
												e.currentTarget.style.borderColor =
													"var(--md-sys-color-outline)";
											}}
										>
											<Calendar className="w-5 h-5 text-(--md-sys-color-on-surface-variant) group-hover:text-(--md-sys-color-primary) transition-colors" />
										</button>
									</div>
									<ActionButton
										icon={
											isInAnyList ? (
												<Check className="w-4 h-4" />
											) : (
												<ListPlus className="w-4 h-4" />
											)
										}
										label={
											isInAnyList
												? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
												: "Add to List"
										}
										onClick={() => setShowListModal(true)}
										isActive={isInAnyList}
										activeColor={colors.primary}
									/>
								</div>
							) : (
								<div className="space-y-3">
									<div
										className="p-4 rounded-xl"
										style={{
											backgroundColor:
												"var(--md-sys-color-surface-container-highest)",
										}}
									>
										<div
											className="flex items-center gap-2"
											style={{ color: "var(--md-sys-color-primary)" }}
										>
											<Check className="w-5 h-5" />
											<span className="m3-title-medium">On Your Shelf</span>
										</div>
										{latestEpisodeWatch && (
											<p
												className="m3-body-medium mt-2"
												style={{
													color: "var(--md-sys-color-on-surface-variant)",
												}}
											>
												Watched on{" "}
												{formatDateWithTimezone(
													latestEpisodeWatch.watchedDate,
													{
														timezone: userTimezone,
														is24Hour,
													},
												)}
											</p>
										)}
										{episodeWatchHistory.length > 1 ? (
											<>
												<div
													className="mt-2 flex items-center gap-2 m3-body-small"
													style={{
														color: "var(--md-sys-color-on-surface-variant)",
													}}
												>
													<History className="w-3 h-3" />
													<span>
														{episodeWatchHistory.length} total watches
													</span>
												</div>
												<button
													type="button"
													onClick={() => setShowHistoryDialog(true)}
													className="mt-2 flex items-center gap-2 m3-body-medium transition-colors py-2 px-3 -ml-3 rounded-lg"
													style={{
														color: "var(--md-sys-color-on-surface-variant)",
													}}
													onMouseEnter={(e) => {
														e.currentTarget.style.color =
															"var(--md-sys-color-on-surface)";
														e.currentTarget.style.backgroundColor =
															"var(--md-sys-color-surface-container)";
													}}
													onMouseLeave={(e) => {
														e.currentTarget.style.color =
															"var(--md-sys-color-on-surface-variant)";
														e.currentTarget.style.backgroundColor =
															"transparent";
													}}
												>
													<Eye className="w-4 h-4" />
													View all watches
												</button>
											</>
										) : (
											<button
												type="button"
												onClick={handleUnmarkWatched}
												disabled={unmarkMutation.isPending}
												className="mt-2 flex items-center gap-2 m3-body-medium transition-colors py-2 px-3 -ml-3 rounded-lg disabled:opacity-50"
												style={{
													color: "var(--md-sys-color-error)",
												}}
												onMouseEnter={(e) => {
													e.currentTarget.style.backgroundColor =
														"var(--md-sys-color-error-container)";
												}}
												onMouseLeave={(e) => {
													e.currentTarget.style.backgroundColor = "transparent";
												}}
											>
												{unmarkMutation.isPending ? (
													<>
														<span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
														Loading
													</>
												) : (
													<>
														<Trash2 className="w-4 h-4" />
														Remove from shelf
													</>
												)}
											</button>
										)}
									</div>
									<div className="flex gap-2">
										<AddToShelfButton
											onClick={handleMarkWatched}
											isPending={isPending}
											label="Watch Again"
											icon={<RotateCcw className="w-4 h-4" />}
											colors={colors}
											size="compact"
											className="flex-1"
										/>
										<button
											type="button"
											onClick={() => setShowDateModal(true)}
											title="Watch episode"
											className="p-3 rounded-xl border transition-all duration-200 flex items-center justify-center group"
											style={{
												backgroundColor: "transparent",
												borderColor: "var(--md-sys-color-outline)",
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.backgroundColor =
													"var(--md-sys-color-surface-container)";
												e.currentTarget.style.borderColor =
													"var(--md-sys-color-primary)";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.backgroundColor = "transparent";
												e.currentTarget.style.borderColor =
													"var(--md-sys-color-outline)";
											}}
										>
											<Calendar className="w-5 h-5 text-(--md-sys-color-on-surface-variant) group-hover:text-(--md-sys-color-primary) transition-colors" />
										</button>
									</div>
									<ActionButton
										icon={
											isInAnyList ? (
												<Check className="w-4 h-4" />
											) : (
												<ListPlus className="w-4 h-4" />
											)
										}
										label={
											isInAnyList
												? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
												: "Add to List"
										}
										onClick={() => setShowListModal(true)}
										isActive={isInAnyList}
										activeColor={colors.primary}
									/>
								</div>
							)
						) : (
							<AddToShelfButton
								onClick={() => router.navigate({ to: "/login" })}
								label="Sign in to Track"
								icon={<Calendar className="w-5 h-5" />}
								colors={colors}
							/>
						)}
						<ActionButton
							icon={<Share2 className="w-4 h-4" />}
							label="Share"
							onClick={handleShare}
						/>
					</div>

					<div className="space-y-6 min-w-0">
						<div className="flex flex-wrap gap-3">
							<Link
								to="/shows/$showId/$title/seasons/$seasonNumber"
								params={{ showId, title, seasonNumber }}
								className="rounded-full border border-(--md-sys-color-outline) px-3 py-1.5 text-sm text-gray-300 flex items-center gap-2 hover:bg-gray-900/40 transition-colors"
							>
								<Layers className="w-4 h-4" />
								Season {seasonNumber}
							</Link>
							<div className="rounded-full border border-(--md-sys-color-outline) px-3 py-1.5 text-sm text-gray-300 flex items-center gap-2">
								<Film className="w-4 h-4" />
								Episode {episodeNumber}
							</div>
							<div className="rounded-full border border-(--md-sys-color-outline) px-3 py-1.5 text-sm text-gray-300 flex items-center gap-2">
								<Calendar className="w-4 h-4" />
								{episode?.air_date
									? formatDateOnly(episode.air_date)
									: "Air date unknown"}
							</div>
							<div className="rounded-full border border-(--md-sys-color-outline) px-3 py-1.5 text-sm text-gray-300 flex items-center gap-2">
								<Star className="w-4 h-4" />
								{episode?.vote_average
									? `${episode.vote_average.toFixed(1)}/10`
									: "Not rated"}
							</div>
						</div>
						<section>
							<h2
								className="text-xl font-semibold mb-3"
								style={{ color: colors.primary }}
							>
								Overview
							</h2>
							<p className="text-gray-300 leading-relaxed mb-4">
								{episode?.overview || "No overview available."}
							</p>
						</section>

						{seasonEpisodeContext.current ? (
							<section>
								<h2
									className="text-xl font-semibold mb-3"
									style={{ color: colors.primary }}
								>
									More In This Season
								</h2>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
									{[
										{
											key: "previous",
											label: "Previous Episode",
											icon: <ArrowLeft className="w-4 h-4" />,
											episode: seasonEpisodeContext.previous,
											highlighted: false,
										},
										{
											key: "current",
											label: "Current Episode",
											icon: <CircleDot className="w-4 h-4" />,
											episode: seasonEpisodeContext.current,
											highlighted: true,
										},
										{
											key: "next",
											label: "Next Episode",
											icon: <ArrowRight className="w-4 h-4" />,
											episode: seasonEpisodeContext.next,
											highlighted: false,
										},
									].map((slot) => {
										if (!slot.episode) return null;
										return (
											<Link
												key={slot.key}
												to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
												params={{
													showId,
													title,
													seasonNumber,
													episodeNumber: String(slot.episode.episode_number),
												}}
												className={`rounded-lg border p-3 transition-colors ${
													slot.highlighted
														? "bg-gray-900/60 border-(--md-sys-color-primary) hover:bg-gray-900/70"
														: "bg-gray-900/30 border-(--md-sys-color-outline) hover:bg-gray-900/50"
												}`}
											>
												<div className="text-xs uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-2">
													{slot.icon}
													{slot.label}
												</div>
												<div
													className={`rounded-md px-2 py-2 ${
														slot.highlighted
															? "bg-(--md-sys-color-primary)/15"
															: ""
													}`}
												>
													<div className="font-medium text-sm">
														E{slot.episode.episode_number}: {slot.episode.name}
													</div>
													<div className="text-xs text-gray-400 mt-1">
														{slot.episode.air_date
															? formatDateOnly(slot.episode.air_date)
															: "TBA"}
													</div>
												</div>
											</Link>
										);
									})}
								</div>
							</section>
						) : null}

						<CastSection cast={showData?.credits?.cast} colors={colors} />
						<CrewSection crew={showData?.credits?.crew} colors={colors} />
					</div>
				</div>
			</div>

			<DatePickerModal
				open={showDateModal}
				onClose={() => setShowDateModal(false)}
				mode="episode"
				showId={showId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				userDid={user?.did}
				modalTitle="Watch Again"
			/>

			{user && (
				<AddToListModal
					open={showListModal}
					onOpenChange={setShowListModal}
					mediaType="show"
					mediaId={showId}
					mediaTitle={showData?.name || "Show"}
					user={user}
				/>
			)}

			<Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
				<DialogContent
					className="max-w-md"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container-highest)",
						borderColor: "var(--md-sys-color-outline)",
						color: "var(--md-sys-color-on-surface)",
					}}
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<History className="w-5 h-5" />
							Watch History
						</DialogTitle>
						<DialogDescription
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							All watches for this episode
						</DialogDescription>
					</DialogHeader>
					<div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
						{episodeWatchHistory.length > 0 ? (
							episodeWatchHistory.map((watch) => (
								<div
									key={watch.id}
									className="flex items-center gap-3 p-3 rounded-lg"
									style={{
										backgroundColor: "var(--md-sys-color-surface-container)",
									}}
								>
									<div className="flex-1">
										<p
											className="m3-body-medium"
											style={{ color: "var(--md-sys-color-on-surface)" }}
										>
											{formatDateWithTimezone(watch.watchedDate, {
												timezone: userTimezone,
												is24Hour,
											})}
										</p>
									</div>
									<button
										type="button"
										onClick={() =>
											deleteWatchEntryMutation.mutate({
												path: { trackedEpisodeId: watch.id },
											})
										}
										disabled={deleteWatchEntryMutation.isPending}
										className="shrink-0 p-2 rounded-lg transition-colors disabled:opacity-50"
										style={{
											color: "var(--md-sys-color-on-surface-variant)",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.color = "var(--md-sys-color-error)";
											e.currentTarget.style.backgroundColor =
												"var(--md-sys-color-error-container)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.color =
												"var(--md-sys-color-on-surface-variant)";
											e.currentTarget.style.backgroundColor = "transparent";
										}}
									>
										{deleteWatchEntryMutation.isPending ? (
											<span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
										) : (
											<Trash2 className="w-4 h-4" />
										)}
									</button>
								</div>
							))
						) : (
							<div
								className="text-center py-8 m3-body-large"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								No watch history found
							</div>
						)}
					</div>
					<div className="mt-4 flex justify-end">
						<M3Button
							variant="outlined"
							onClick={() => setShowHistoryDialog(false)}
						>
							Close
						</M3Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
