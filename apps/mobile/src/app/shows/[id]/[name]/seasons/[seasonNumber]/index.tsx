import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	type Href,
	Link,
	router,
	Stack,
	useLocalSearchParams,
} from "expo-router";
import { useRef } from "react";
import type { FlatListInstance } from "react-native";
import {
	FlatList,
	findNodeHandle,
	Pressable,
	RefreshControl,
	View,
} from "react-native";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { CastSection, CrewSection } from "@/components/detail/CreditsSection";
import { DetailActions } from "@/components/detail/DetailActions";
import { DetailColumns } from "@/components/detail/DetailColumns";
import { DetailHero } from "@/components/detail/DetailHero";
import { DetailsCard } from "@/components/detail/DetailsCard";
import { EpisodeCard } from "@/components/detail/EpisodeCard";
import { FriendWatchers } from "@/components/detail/FriendWatchers";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { PrevNextNav } from "@/components/detail/PrevNextNav";
import { SimilarMedia } from "@/components/detail/SimilarMedia";
import { WatchProviders } from "@/components/detail/WatchProviders";
import { ScreenFrame } from "@/components/ui/screen-frame";
import { DetailSkeleton, ListRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import {
	backdropUrl,
	formatLongDate,
	posterUrl,
	yearFromDate,
} from "@/lib/tmdb";
import { useMediaRating } from "@/lib/use-media-rating";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { findShowProgress, useShowProgress } from "@/lib/use-show-progress";
import { useUpNext } from "@/lib/use-up-next";
import { webMediaUrl } from "@/lib/web-url";
import { useThemeColors } from "@/theme/colors";

export default function SeasonDetailScreen() {
	const themeColors = useThemeColors();
	const { id, name, seasonNumber, reviewId } = useLocalSearchParams<{
		id: string;
		// The slug segment. Carried through sibling links so in-app navigation
		// produces the same URLs the Web App does (ADR 0023).
		name: string;
		seasonNumber: string;
		reviewId?: string;
	}>();
	const showId = Number(id);
	const seasonNum = Number(seasonNumber);
	const listRef = useRef<FlatListInstance>(null);

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
	const { data: mediaRating } = useMediaRating({
		mediaType: "season",
		mediaId: id,
		seasonNumber: seasonNum,
	});
	const rating = mediaRating?.averageRating ?? data?.vote_average;
	const { refreshing, onRefresh } = useRefreshActiveQueries();
	const progressQuery = useShowProgress([id]);
	const showProgress = findShowProgress(progressQuery.data, id);
	const seasonProgress = showProgress?.seasons.find(
		(season) => season.seasonNumber === seasonNum,
	);

	// Episode rows share the cached history index for per-episode Watch state.
	const upNext = useUpNext(20, id);
	const upNextItems = upNext.items;
	const { isAuthenticated } = useAuth();

	const totalEpisodes = seasonProgress?.episodesTotal ?? 0;
	const nextEpisode = upNextItems.find((i) => i.showId === id)?.nextEpisode;
	const upNextEpisodeNumber =
		nextEpisode?.seasonNumber === seasonNum
			? nextEpisode.episodeNumber
			: undefined;

	// Lead with the episode to watch next in this season, worded like the Web
	// App's season page. Its destination depends on Up Next, so the space holds
	// a skeleton until that query settles.
	const seasonEpisodesWatched = seasonProgress?.episodesWatched ?? 0;
	const continueTo =
		!isAuthenticated || upNext.isError
			? undefined
			: upNext.isLoading || progressQuery.isLoading
				? ("loading" as const)
				: {
						label: upNextEpisodeNumber
							? `Continue S${seasonNum}E${upNextEpisodeNumber}`
							: seasonEpisodesWatched > 0
								? "Rewatch from start"
								: "Start watching",
						href: `/shows/${id}/${name}/seasons/${seasonNum}/episodes/${upNextEpisodeNumber ?? 1}` as Href,
					};

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
		router.replace(`/shows/${id}/${name}/seasons/${season}` as const);
	};

	return (
		<ScreenFrame>
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
				<DetailColumns
					primary={
						<>
							<DetailHero
								title={data.name}
								backdropUrl={backdropUrl(showData?.backdrop_path)}
								posterUrl={posterUrl(data.poster_path)}
								posterHref={`/shows/${id}/${name}`}
								rating={rating}
								progress={
									seasonProgress?.state !== "unavailable"
										? seasonProgress
										: undefined
								}
								progressLabel="Season progress"
								isProgressLoading={progressQuery.isLoading}
							>
								<View className="gap-3">
									<View className="flex-row flex-wrap items-center gap-x-1">
										{showData?.name ? (
											<>
												<Link href={`/shows/${id}/${name}`} asChild>
													<Pressable>
														<Text className="font-medium text-foreground/80 text-xs">
															{showData.name}
														</Text>
													</Pressable>
												</Link>
												<Text className="text-muted-foreground text-xs">·</Text>
											</>
										) : null}
										<Text className="font-medium text-foreground text-xs">
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

							<DetailActions
								tracking={{
									mediaType: "season",
									showId: id,
									seasonNumber: seasonNum,
									episodeCount: totalEpisodes,
									progress: seasonProgress,
									continueTo,
								}}
								target={{
									mediaType: "show",
									mediaId: id,
									seasonNumber: seasonNum,
								}}
								share={
									showData?.name
										? {
												url: webMediaUrl({
													type: "season",
													showId: id,
													showName: showData.name,
													seasonNumber: seasonNum,
												}),
												title: `${showData.name} — ${data.name}`,
											}
										: undefined
								}
							/>

							<PrevNextNav
								previous={
									prevSeason
										? {
												label: "Previous season",
												code: `S${prevSeason.season_number}`,
												onPress: () => goToSeason(prevSeason.season_number),
											}
										: undefined
								}
								next={
									nextSeason
										? {
												label: "Next season",
												code: `S${nextSeason.season_number}`,
												onPress: () => goToSeason(nextSeason.season_number),
											}
										: undefined
								}
							/>
						</>
					}
					secondary={
						<>
							<OverviewSection text={data.overview} />
							<FriendWatchers
								mediaType="show"
								mediaId={`${id}:season:${seasonNum}`}
							/>
						</>
					}
					renderContent={(header) => (
						<FlatList
							key={`${id}:${seasonNumber}`}
							ref={listRef}
							className="flex-1"
							contentContainerStyle={{ paddingBottom: 48 }}
							data={data.episodes}
							keyExtractor={(episode) => String(episode.id)}
							initialNumToRender={6}
							maxToRenderPerBatch={6}
							windowSize={5}
							renderItem={({ item: ep }) => (
								<View className="px-4 pb-2">
									<EpisodeCard
										actions
										upNext={ep.episode_number === upNextEpisodeNumber}
										episode={{
											showId,
											showSlug: name,
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
								</View>
							)}
							ListEmptyComponent={
								<EmptyState
									title="No episodes"
									message="This season has no episodes yet."
								/>
							}
							showsVerticalScrollIndicator={false}
							refreshControl={
								<RefreshControl
									refreshing={refreshing}
									onRefresh={onRefresh}
									tintColor={themeColors.accent}
									colors={[themeColors.accent]}
								/>
							}
							ListHeaderComponent={
								<View className="gap-6 pb-6">
									{header}
									<Text className="px-4 text-display-3 text-foreground">
										Episodes
									</Text>
								</View>
							}
							ListFooterComponent={
								<View className="gap-6 pt-6">
									<DetailsCard
										title="Details"
										items={[
											{ label: "Season Number", value: data.season_number },
											{ label: "Episodes", value: data.episodes.length },
											{
												label: "Air Date",
												value: formatLongDate(data.air_date) ?? "Unknown",
											},
											{
												label: "Rating",
												value:
													rating && rating > 0
														? `${rating.toFixed(1)}/10`
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
										onFocusReview={(section) => {
											const scrollView = listRef.current?.getNativeScrollRef();
											const scrollNode =
												scrollView && findNodeHandle(scrollView);
											if (scrollNode == null) return;
											section.measureLayout(scrollNode, (_x, y) => {
												listRef.current?.scrollToOffset({
													offset: Math.max(0, y - 12),
													animated: true,
												});
											});
										}}
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
								</View>
							}
						/>
					)}
				/>
			)}
		</ScreenFrame>
	);
}
