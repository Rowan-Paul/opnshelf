import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkShowWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TmdbShowDetailDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Outlet,
	useMatches,
	useRouter,
} from "@tanstack/react-router";
import { Calendar, Tv } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddToListModal } from "@/components/AddToListModal";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
import { DatePickerModal } from "@/components/DatePickerModal";
import {
	type ColorTheme,
	DetailActions,
	DetailHero,
	MetadataPills,
	SeasonCard,
} from "@/components/detail";
import { GenresSection } from "@/components/GenresSection";
import { useTheme } from "@/components/theme-provider";
import {
	formatDateOnly,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
} from "@/lib/utils";

export const Route = createFileRoute("/shows/$showId/$title")({
	loader: async ({ params, context }) => {
		const { showId } = params;
		const { queryClient } = context;

		const showData = await queryClient.fetchQuery({
			...showsControllerGetShowDetailsOptions({
				path: { showId },
			}),
		});

		return showData;
	},
	head: ({ loaderData }) => {
		const show = loaderData as TmdbShowDetailDto | undefined;
		const showName = show?.name;
		const title = showName ? `${showName} | OpnShelf` : "Show | OpnShelf";
		const posterUrl = show?.poster_path
			? `https://image.tmdb.org/t/p/w780${show.poster_path}`
			: null;
		const url = typeof window !== "undefined" ? window.location.href : "";

		return {
			meta: [
				{ title },
				{
					name: "description",
					content: show?.overview?.slice(0, 160) || "",
				},
				{ property: "og:title", content: title },
				{
					property: "og:description",
					content: show?.overview?.slice(0, 160) || "",
				},
				{ property: "og:type", content: "video.tv" },
				{ property: "og:url", content: url },
				...(posterUrl ? [{ property: "og:image", content: posterUrl }] : []),
				{ property: "og:image:width", content: "780" },
				{ property: "og:image:height", content: "1170" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: title },
				{
					name: "twitter:description",
					content: show?.overview?.slice(0, 160) || "",
				},
				...(posterUrl ? [{ name: "twitter:image", content: posterUrl }] : []),
				{ name: "twitter:url", content: url },
			],
		};
	},
	component: ShowDetailPage,
});

function ShowDetailPage() {
	const { showId, title } = Route.useParams();
	const matches = useMatches();
	const isLeafRoute = matches[matches.length - 1]?.routeId === Route.id;
	const router = useRouter();
	const queryClient = useQueryClient();
	const { seedColor } = useTheme();

	const [showListModal, setShowListModal] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: showData, isLoading } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId },
		}),
	});

	const show = showData as TmdbShowDetailDto | undefined;

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: user?.did || "", showId },
		}),
		enabled: !!user?.did,
	});

	const { data: listsForShow } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: showId },
		}),
		enabled: !!user?.did,
	});

	const listsCount = listsForShow?.filter((l) => l.isInList).length ?? 0;
	const watchedEpisodeCount = history?.length ?? 0;

	const colors: ColorTheme = {
		primary: show?.colors?.primary || seedColor,
		secondary: show?.colors?.secondary || seedColor,
		accent: show?.colors?.accent || seedColor,
		muted: show?.colors?.muted || "#6b7280",
	};

	const backdropUrl = getTmdbBackdropUrl(show?.backdrop_path);
	const posterUrl = getTmdbPosterUrl(show?.poster_path, "w500");
	const seasonCount = show?.number_of_seasons || 0;
	const episodeCount = show?.number_of_episodes || 0;

	const markShowWatchedMutation = useMutation({
		mutationKey: ["shows", showId, "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: user?.did || "", showId },
				}),
			});
			toast.success(`Marked ${data.count} episodes as watched`);
		},
		onError: () => {
			toast.error("Failed to mark show as watched. Please try again.");
		},
	});

	const unmarkShowWatchedMutation = useMutation({
		mutationKey: ["shows", showId, "unmarkShowWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: user?.did || "", showId },
				}),
			});
			toast.success("Removed all episodes from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf. Please try again.");
		},
	});

	const handleMarkWatched = () => {
		markShowWatchedMutation.mutate({
			body: { showId },
		});
	};

	const handleUnmarkWatched = () => {
		unmarkShowWatchedMutation.mutate({
			path: { showId },
			query: { mode: "all" },
		});
	};

	const metadataItems = useMemo(() => {
		const items = [];
		if (show?.first_air_date) {
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: formatDateOnly(show.first_air_date),
			});
		}
		if (seasonCount > 0) {
			items.push({
				icon: <Tv className="w-4 h-4" />,
				label: `${seasonCount} season${seasonCount !== 1 ? "s" : ""}`,
			});
		}
		if (episodeCount > 0) {
			items.push({
				icon: <Tv className="w-4 h-4" />,
				label: `${episodeCount} episodes`,
			});
		}
		return items;
	}, [show?.first_air_date, episodeCount, seasonCount]);

	const seasonWatchedCounts = useMemo(() => {
		if (!history) return new Map<number, number>();
		const counts = new Map<number, number>();
		for (const h of history) {
			const current = counts.get(h.seasonNumber) ?? 0;
			counts.set(h.seasonNumber, current + 1);
		}
		return counts;
	}, [history]);

	return (
		<div>
			{isLeafRoute && (
				<>
					<DetailHero
						title={show?.name || title.replace(/-/g, " ")}
						backdropUrl={backdropUrl}
						posterUrl={posterUrl}
						colors={colors}
						isLoading={isLoading}
						onBack={() => router.history.back()}
					/>

					<div className="container mx-auto px-4 py-6 max-w-6xl">
						<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
							<div className="space-y-4 min-w-0">
								<DetailActions
									mediaType="show"
									mediaId={showId}
									colors={colors}
									isWatched={watchedEpisodeCount > 0}
									watchedDate={null}
									totalWatches={watchedEpisodeCount}
									onMarkWatched={handleMarkWatched}
									onUnmarkWatched={handleUnmarkWatched}
									onShowDatePicker={() => setShowDateModal(true)}
									isMarkingPending={markShowWatchedMutation.isPending}
									isUnmarkingPending={unmarkShowWatchedMutation.isPending}
									listsCount={listsCount}
									onShowListModal={() => setShowListModal(true)}
									isLoggedIn={!!user}
									onLogin={() => router.navigate({ to: "/login" })}
								/>
							</div>

							<div className="space-y-6 min-w-0">
								<MetadataPills items={metadataItems} />

								<section>
									<h2
										className="text-xl font-semibold mb-3"
										style={{ color: colors.primary }}
									>
										Overview
									</h2>
									<p className="text-gray-300 leading-relaxed">
										{show?.overview || "No overview available."}
									</p>
								</section>

								<GenresSection genres={show?.genres} colors={colors} />

								{seasonCount > 0 && (
									<section>
										<h2
											className="text-xl font-semibold mb-4"
											style={{ color: colors.primary }}
										>
											Seasons
										</h2>
										<div className="space-y-3">
											{show?.seasons?.map((season) => {
												const watchedCount =
													seasonWatchedCounts.get(season.season_number) ?? 0;

												return (
													<SeasonCard
														key={season.id}
														showId={showId}
														title={title}
														seasonNumber={season.season_number}
														airDate={season.air_date}
														episodeCount={season.episode_count ?? 0}
														watchedCount={watchedCount}
														colors={colors}
														posterUrl={getTmdbPosterUrl(
															season.poster_path,
															"w500",
														)}
														userDid={user?.did}
													/>
												);
											})}
										</div>
									</section>
								)}

								<CastSection cast={show?.credits?.cast} colors={colors} />
								<CrewSection crew={show?.credits?.crew} colors={colors} />
							</div>
						</div>
					</div>
				</>
			)}
			<Outlet />

			{user && (
				<AddToListModal
					open={showListModal}
					onOpenChange={setShowListModal}
					mediaType="show"
					mediaId={showId}
					mediaTitle={show?.name || ""}
					user={user}
				/>
			)}

			<DatePickerModal
				open={showDateModal}
				onClose={() => setShowDateModal(false)}
				mode="show"
				showId={showId}
				userDid={user?.did}
				modalTitle="Select Watch Date"
			/>
		</div>
	);
}
