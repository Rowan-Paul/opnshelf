import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { CastSection, CrewSection } from "@/components/detail/CreditsSection";
import { DetailHero } from "@/components/detail/DetailHero";
import { DetailsCard } from "@/components/detail/DetailsCard";
import { EpisodeCard } from "@/components/detail/EpisodeCard";
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
import { DetailSkeleton, ListRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import {
	backdropUrl,
	formatLongDate,
	posterUrl,
	yearFromDate,
} from "@/lib/tmdb";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { useUpNext } from "@/lib/use-up-next";
import { useWatchStatus } from "@/lib/use-watch-status";
import { webMediaUrl } from "@/lib/web-url";

export default function SeasonDetailScreen() {
	const { id, seasonNumber, reviewId } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
		reviewId?: string;
	}>();
	const showId = Number(id);
	const seasonNum = Number(seasonNumber);
	const scrollRef = useRef<ScrollView>(null);

	const { data, isLoading, isError } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId: id, seasonNumber },
		}),
		enabled: Boolean(id) && Boolean(seasonNumber),
	});

	// The season payload has no credits; reuse the show's aggregate cast/crew
	// (cached if the show page was visited) so the season page mirrors the web.
	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({ path: { showId: id } }),
		enabled: Boolean(id),
	});
	const { refreshing, onRefresh } = useRefreshActiveQueries();

	// Per-episode watched status (for the progress card) + the show's next
	// unwatched episode (to flag the "Up Next" row), mirroring the web page.
	const watch = useWatchStatus({ mediaType: "show", showId: id });
	const { items: upNextItems } = useUpNext(20, id);

	const totalEpisodes = data?.episodes.length ?? 0;
	const episodesWatched = new Set(
		(watch.showWatchHistory ?? [])
			.filter((e) => e.seasonNumber === seasonNum)
			.map((e) => e.episodeNumber),
	).size;
	const nextEpisode = upNextItems.find((i) => i.showId === id)?.nextEpisode;
	const upNextEpisodeNumber =
		nextEpisode?.seasonNumber === seasonNum
			? nextEpisode.episodeNumber
			: undefined;

	// Prev/next season navigation, derived from the show's real seasons list.
	const orderedSeasons = (showData?.seasons ?? [])
		.filter((s) => s.season_number > 0)
		.sort((a, b) => a.season_number - b.season_number);
	const currentIndex = orderedSeasons.findIndex(
		(s) => s.season_number === seasonNum,
	);
	const prevSeason =
		currentIndex > 0 ? orderedSeasons[currentIndex - 1] : undefined;
	const nextSeason =
		currentIndex >= 0 && currentIndex < orderedSeasons.length - 1
			? orderedSeasons[currentIndex + 1]
			: undefined;
	const goToSeason = (season: number) => {
		// Replace rather than push so paging between seasons doesn't stack history.
		router.replace(`/show/${id}/season/${season}` as const);
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: data?.name ?? "Season" }}
			/>
			{isLoading ? (
				<View className="gap-6">
					<DetailSkeleton />
					{/* Season pages are episode-list-heavy: a few extra rows below
					    the hero convey the list rather than just the header. */}
					<View className="px-4">
						<ListRowsSkeleton rows={4} />
					</View>
				</View>
			) : isError || !data ? (
				<ErrorState message="Couldn't load this season." />
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
						backdropUrl={backdropUrl(showData?.backdrop_path)}
						posterUrl={posterUrl(data.poster_path)}
						posterHref={`/show/${id}`}
						rating={data.vote_average}
					>
						<View className="gap-3">
							<View className="flex-row flex-wrap items-center gap-x-1">
								{showData?.name ? (
									<>
										<Link href={`/show/${id}`} asChild>
											<Pressable>
												<Text className="font-medium text-primary text-xs">
													{showData.name}
												</Text>
											</Pressable>
										</Link>
										<Text className="text-muted-foreground text-xs">·</Text>
									</>
								) : null}
								<Text className="font-medium text-primary text-xs">
									Season {data.season_number}
								</Text>
							</View>

							<MetadataPills
								items={[
									yearFromDate(data.air_date),
									`${data.episodes.length} episodes`,
								]}
							/>
						</View>
					</DetailHero>

					<View className="gap-2">
						<MediaTrackingActions
							mediaType="season"
							showId={id}
							seasonNumber={seasonNum}
							episodeCount={totalEpisodes}
						/>
						<WatchlistFavoritesButtons
							mediaType="show"
							mediaId={id}
							seasonNumber={seasonNum}
						/>
						{/* Secondary actions as one row of compact tiles. */}
						<View className="flex-row gap-2 px-4">
							<RateReviewButton
								mediaType="show"
								mediaId={id}
								seasonNumber={seasonNum}
							/>
							<AddToListButton
								mediaType="show"
								mediaId={id}
								seasonNumber={seasonNum}
							/>
							<NoteButton
								mediaType="show"
								mediaId={id}
								seasonNumber={seasonNum}
							/>
							{showData?.name ? (
								<ShareButton
									url={webMediaUrl({
										type: "season",
										showId: id,
										showName: showData.name,
										seasonNumber: seasonNum,
									})}
									title={`${showData.name} — ${data.name}`}
								/>
							) : null}
						</View>
					</View>

					{prevSeason || nextSeason ? (
						<View className="flex-row gap-2 px-4">
							<Pressable
								onPress={() =>
									prevSeason && goToSeason(prevSeason.season_number)
								}
								disabled={!prevSeason}
								className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
								style={{ opacity: prevSeason ? 1 : 0.4 }}
							>
								<ChevronLeft color="#94a3b8" size={18} />
								<Text className="font-semibold text-foreground">
									Prev season
								</Text>
							</Pressable>
							<Pressable
								onPress={() =>
									nextSeason && goToSeason(nextSeason.season_number)
								}
								disabled={!nextSeason}
								className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
								style={{ opacity: nextSeason ? 1 : 0.4 }}
							>
								<Text className="font-semibold text-foreground">
									Next season
								</Text>
								<ChevronRight color="#94a3b8" size={18} />
							</Pressable>
						</View>
					) : null}

					{watch.isAuthenticated ? (
						<ProgressCard
							episodesWatched={episodesWatched}
							totalEpisodes={totalEpisodes}
						/>
					) : null}

					<OverviewSection text={data.overview} />

					<FriendWatchers
						mediaType="show"
						mediaId={`${id}:season:${seasonNum}`}
					/>

					{data.episodes.length === 0 ? (
						<EmptyState
							title="No episodes"
							message="This season has no episodes yet."
						/>
					) : (
						<View className="gap-2 px-4">
							{data.episodes.map((ep) => (
								<EpisodeCard
									key={ep.id}
									actions
									upNext={ep.episode_number === upNextEpisodeNumber}
									episode={{
										showId,
										seasonNumber: ep.season_number,
										episodeNumber: ep.episode_number,
										name: ep.name,
										overview: ep.overview,
										stillPath: ep.still_path,
										airDate: yearFromDate(ep.air_date),
										rating: ep.vote_average,
										runtime: ep.runtime,
									}}
								/>
							))}
						</View>
					)}

					<DetailsCard
						title="Season Details"
						items={[
							{ label: "Season", value: data.season_number },
							{ label: "Episodes", value: data.episodes.length },
							{
								label: "Air Date",
								value: formatLongDate(data.air_date) ?? "Unknown",
							},
							{
								label: "Rating",
								value:
									data.vote_average && data.vote_average > 0
										? `${data.vote_average.toFixed(1)} / 10`
										: undefined,
							},
						]}
					/>

					<WatchProviders mediaType="show" mediaId={id} />

					<CastSection cast={showData?.credits?.cast} />
					<CrewSection crew={showData?.credits?.crew} />
					<CommunityReviews
						mediaType="show"
						mediaId={id}
						seasonNumber={Number(seasonNumber)}
						scrollRef={scrollRef}
						focusReviewId={reviewId}
						mediaWebUrl={
							showData?.name
								? webMediaUrl({
										type: "season",
										showId: id,
										showName: showData.name,
										seasonNumber: seasonNum,
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
