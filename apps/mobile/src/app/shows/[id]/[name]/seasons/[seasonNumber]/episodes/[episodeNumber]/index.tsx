import {
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import {
	CastSection,
	CreditsSection,
	CrewSection,
} from "@/components/detail/CreditsSection";
import { DetailHero } from "@/components/detail/DetailHero";
import { DetailsCard } from "@/components/detail/DetailsCard";
import { FriendWatchers } from "@/components/detail/FriendWatchers";
import { MediaTrackingActions } from "@/components/detail/MediaTrackingActions";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { NoteButton } from "@/components/detail/NoteButton";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { ProgressCard } from "@/components/detail/ProgressCard";
import { RateReviewButton } from "@/components/detail/RateReviewButton";
import { ShareButton } from "@/components/detail/ShareButton";
import { SimilarMedia } from "@/components/detail/SimilarMedia";
import { WatchlistFavoritesButtons } from "@/components/detail/WatchlistFavoritesButtons";
import { WatchProviders } from "@/components/detail/WatchProviders";
import { DetailSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import {
	formatLongDate,
	formatRuntime,
	posterUrl,
	stillUrl,
	yearFromDate,
} from "@/lib/tmdb";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { useWatchStatus } from "@/lib/use-watch-status";
import { webMediaUrl } from "@/lib/web-url";

export default function EpisodeDetailScreen() {
	const { id, name, seasonNumber, episodeNumber, reviewId } =
		useLocalSearchParams<{
			id: string;
			// The slug segment. Carried through sibling links so in-app navigation
			// produces the same URLs the Web App does (ADR 0023).
			name: string;
			seasonNumber: string;
			episodeNumber: string;
			reviewId?: string;
		}>();
	const seasonNum = Number(seasonNumber);
	const episodeNum = Number(episodeNumber);
	const scrollRef = useRef<ScrollView>(null);

	const { data, isLoading, isError } = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId: id, seasonNumber, episodeNumber },
		}),
		enabled: Boolean(id) && Boolean(seasonNumber) && Boolean(episodeNumber),
	});
	const { refreshing, onRefresh } = useRefreshActiveQueries();

	// Episode neighbours: use the show's season list (each season's
	// episode_count) to compute prev/next, hopping across season boundaries the
	// same way web does — at episode 1 go to the previous season's last episode;
	// at a season's last episode go to the next season's episode 1.
	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({ path: { showId: id } }),
		enabled: Boolean(id),
	});

	const seasons = (showData?.seasons ?? [])
		.filter((s) => s.season_number > 0)
		.sort((a, b) => a.season_number - b.season_number);
	const currentSeasonCount =
		seasons.find((s) => s.season_number === seasonNum)?.episode_count ?? 0;

	// Season progress: distinct episodes watched within this season, out of
	// the season's episode count. Reuses the same show watch history that
	// backs the season screen's "Your Progress" card.
	const watch = useWatchStatus({ mediaType: "show", showId: id });
	const seasonEpisodesWatched = new Set(
		(watch.showWatchHistory ?? [])
			.filter((e) => e.seasonNumber === seasonNum)
			.map((e) => e.episodeNumber),
	).size;

	let prevEpisode: { season: number; episode: number } | null = null;
	if (episodeNum > 1) {
		prevEpisode = { season: seasonNum, episode: episodeNum - 1 };
	} else {
		const prevSeason = seasons.find((s) => s.season_number === seasonNum - 1);
		if (prevSeason) {
			prevEpisode = {
				season: prevSeason.season_number,
				episode: prevSeason.episode_count || 1,
			};
		}
	}

	let nextEpisode: { season: number; episode: number } | null = null;
	if (currentSeasonCount > 0 && episodeNum < currentSeasonCount) {
		nextEpisode = { season: seasonNum, episode: episodeNum + 1 };
	} else {
		const nextSeason = seasons.find((s) => s.season_number === seasonNum + 1);
		if (nextSeason) {
			nextEpisode = { season: nextSeason.season_number, episode: 1 };
		}
	}

	const goToEpisode = (target: { season: number; episode: number }) => {
		// Replace rather than push: stepping through episodes shouldn't pile up a
		// long back stack — Back should return to where you entered, not unwind
		// every episode you paged through.
		router.replace(
			`/shows/${id}/${name}/seasons/${target.season}/episodes/${target.episode}` as const,
		);
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: data?.name ?? "Episode" }}
			/>
			{isLoading ? (
				<DetailSkeleton />
			) : isError || !data ? (
				<ErrorState message="Couldn't load this episode." />
			) : (
				<ScrollView
					ref={scrollRef}
					className="flex-1"
					contentContainerClassName="gap-6 pb-12"
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							tintColor="#f3bc00"
							colors={["#f3bc00"]}
						/>
					}
				>
					<DetailHero
						title={data.name}
						backdropUrl={stillUrl(data.still_path, "w780")}
						posterUrl={posterUrl(showData?.poster_path)}
						posterHref={`/shows/${id}/${name}`}
						rating={data.vote_average}
					>
						<View className="gap-3">
							<View className="flex-row flex-wrap items-center gap-x-1">
								{showData?.name ? (
									<>
										<Link href={`/shows/${id}/${name}`} asChild>
											<Pressable>
												<Text className="font-medium text-primary text-xs">
													{showData.name}
												</Text>
											</Pressable>
										</Link>
										<Text className="text-muted-foreground text-xs">·</Text>
									</>
								) : null}
								<Link
									href={`/shows/${id}/${name}/seasons/${seasonNum}`}
									asChild
								>
									<Pressable>
										<Text className="font-medium text-primary text-xs">
											Season {data.season_number}
										</Text>
									</Pressable>
								</Link>
								<Text className="text-muted-foreground text-xs">·</Text>
								<Text className="font-medium text-primary text-xs">
									Episode {data.episode_number}
								</Text>
							</View>

							<MetadataPills
								items={[
									`S${data.season_number}E${data.episode_number}`,
									yearFromDate(data.air_date),
									formatRuntime(data.runtime),
								]}
							/>
						</View>
					</DetailHero>

					<View className="gap-2">
						<MediaTrackingActions
							mediaType="episode"
							showId={id}
							seasonNumber={seasonNum}
							episodeNumber={episodeNum}
						/>
						<WatchlistFavoritesButtons
							mediaType="show"
							mediaId={id}
							seasonNumber={seasonNum}
							episodeNumber={episodeNum}
						/>
						{/* Secondary actions as one row of compact tiles. */}
						<View className="flex-row gap-2 px-4">
							<RateReviewButton
								mediaType="show"
								mediaId={id}
								seasonNumber={seasonNum}
								episodeNumber={episodeNum}
							/>
							<AddToListButton
								mediaType="show"
								mediaId={id}
								seasonNumber={seasonNum}
								episodeNumber={episodeNum}
							/>
							<NoteButton
								mediaType="show"
								mediaId={id}
								seasonNumber={seasonNum}
								episodeNumber={episodeNum}
							/>
							{showData?.name ? (
								<ShareButton
									url={webMediaUrl({
										type: "episode",
										showId: id,
										showName: showData.name,
										seasonNumber: seasonNum,
										episodeNumber: episodeNum,
									})}
									title={`${showData.name} — ${data.name}`}
								/>
							) : null}
						</View>
					</View>

					<View className="flex-row gap-2 px-4">
						<Pressable
							onPress={() => prevEpisode && goToEpisode(prevEpisode)}
							disabled={!prevEpisode}
							className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
							style={{ opacity: prevEpisode ? 1 : 0.4 }}
						>
							<ChevronLeft color="#94a3b8" size={18} />
							<Text className="font-semibold text-foreground">
								{prevEpisode
									? `Prev (S${prevEpisode.season}E${prevEpisode.episode})`
									: "Previous"}
							</Text>
						</Pressable>
						<Pressable
							onPress={() => nextEpisode && goToEpisode(nextEpisode)}
							disabled={!nextEpisode}
							className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
							style={{ opacity: nextEpisode ? 1 : 0.4 }}
						>
							<Text className="font-semibold text-foreground">
								{nextEpisode
									? `Next (S${nextEpisode.season}E${nextEpisode.episode})`
									: "Next"}
							</Text>
							<ChevronRight color="#94a3b8" size={18} />
						</Pressable>
					</View>

					{watch.isAuthenticated ? (
						<ProgressCard
							episodesWatched={seasonEpisodesWatched}
							totalEpisodes={currentSeasonCount}
						/>
					) : null}

					<OverviewSection text={data.overview} />
					<DetailsCard
						title="Episode Details"
						items={[
							{
								label: "Director",
								value:
									data.crew?.find((p) => p.job === "Director")?.name ||
									"Unknown",
							},
							{
								label: "Air Date",
								value: formatLongDate(data.air_date) ?? "Unknown",
							},
							{ label: "Runtime", value: formatRuntime(data.runtime) },
							{
								label: "Rating",
								value:
									data.vote_average && data.vote_average > 0
										? `${data.vote_average.toFixed(1)} / 10`
										: undefined,
							},
						]}
					/>
					<FriendWatchers
						mediaType="show"
						mediaId={`${id}:season:${seasonNum}:episode:${episodeNum}`}
					/>
					<WatchProviders mediaType="show" mediaId={id} />
					<CastSection cast={showData?.credits?.cast} />
					<CreditsSection
						title="Guest Stars"
						people={(data.guest_stars ?? []).slice(0, 20).map((g) => ({
							id: g.id,
							name: g.name,
							role: g.character,
							profile_path: g.profile_path,
						}))}
					/>
					<CrewSection crew={data.crew} />
					<CommunityReviews
						mediaType="show"
						mediaId={id}
						seasonNumber={seasonNum}
						episodeNumber={episodeNum}
						scrollRef={scrollRef}
						focusReviewId={reviewId}
						mediaWebUrl={
							showData?.name
								? webMediaUrl({
										type: "episode",
										showId: id,
										showName: showData.name,
										seasonNumber: seasonNum,
										episodeNumber: episodeNum,
									})
								: undefined
						}
					/>
					<SimilarMedia mediaType="show" mediaId={id} />
				</ScrollView>
			)}
		</View>
	);
}
