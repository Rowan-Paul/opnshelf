import { showsControllerGetShowDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { AddToLibraryButton } from "@/components/detail/AddToLibraryButton";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { CastSection, CrewSection } from "@/components/detail/CreditsSection";
import { DetailHero } from "@/components/detail/DetailHero";
import { DetailsCard } from "@/components/detail/DetailsCard";
import { FriendWatchers } from "@/components/detail/FriendWatchers";
import { MediaTrackingActions } from "@/components/detail/MediaTrackingActions";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { NoteButton } from "@/components/detail/NoteButton";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { RateReviewButton } from "@/components/detail/RateReviewButton";
import { SeasonCard } from "@/components/detail/SeasonCard";
import { ShareButton } from "@/components/detail/ShareButton";
import { SimilarMedia } from "@/components/detail/SimilarMedia";
import { WatchlistFavoritesButtons } from "@/components/detail/WatchlistFavoritesButtons";
import { WatchProviders } from "@/components/detail/WatchProviders";
import { DetailSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import {
	backdropUrl,
	formatLongDate,
	posterUrl,
	yearFromDate,
} from "@/lib/tmdb";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { webMediaUrl } from "@/lib/web-url";

export default function ShowDetailScreen() {
	const { id, reviewId } = useLocalSearchParams<{
		id: string;
		reviewId?: string;
	}>();
	const showId = Number(id);
	const scrollRef = useRef<ScrollView>(null);

	const { data, isLoading, isError } = useQuery({
		...showsControllerGetShowDetailsOptions({ path: { showId: id } }),
		enabled: Boolean(id),
	});
	const { refreshing, onRefresh } = useRefreshActiveQueries();

	// Hide the placeholder "Season 0" specials when there are real seasons.
	const seasons = (data?.seasons ?? []).filter(
		(s) => s.season_number > 0 || (data?.seasons?.length ?? 0) === 1,
	);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: data?.name ?? "Show" }}
			/>
			{isLoading ? (
				<DetailSkeleton />
			) : isError || !data ? (
				<ErrorState message="Couldn't load this show." />
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
						backdropUrl={backdropUrl(data.backdrop_path)}
						posterUrl={posterUrl(data.poster_path)}
						rating={data.vote_average}
					>
						<MetadataPills
							items={[
								yearFromDate(data.first_air_date),
								data.number_of_seasons
									? `${data.number_of_seasons} season${data.number_of_seasons === 1 ? "" : "s"}`
									: undefined,
								data.number_of_episodes
									? `${data.number_of_episodes} episodes`
									: undefined,
								...(data.genres ?? []).map((g) => g.name),
							]}
						/>
					</DetailHero>

					{/* Shelf, watchlist and secondary tiles form one action cluster,
					    kept tight (gap-2) like the season/episode screens. */}
					<View className="gap-2">
						<MediaTrackingActions
							mediaType="show"
							showId={id}
							episodeCount={data.number_of_episodes}
						/>
						<WatchlistFavoritesButtons mediaType="show" mediaId={id} />
						{/* Secondary actions as one row of compact tiles. */}
						<View className="flex-row gap-2 px-4">
							<RateReviewButton mediaType="show" mediaId={id} />
							<AddToListButton mediaType="show" mediaId={id} />
							<AddToLibraryButton mediaType="show" mediaId={id} />
							<NoteButton mediaType="show" mediaId={id} />
							<ShareButton
								url={webMediaUrl({ type: "show", id, name: data.name })}
								title={data.name}
							/>
						</View>
					</View>

					<OverviewSection text={data.overview} />
					<DetailsCard
						items={[
							{
								label: "Creator",
								value:
									data.credits?.crew
										?.filter((p) => p.job === "Creator")
										.map((p) => p.name)
										.join(", ") || "Unknown",
							},
							{ label: "Seasons", value: data.number_of_seasons || 0 },
							{ label: "Episodes", value: data.number_of_episodes || 0 },
							{
								label: "First Aired",
								value: formatLongDate(data.first_air_date) ?? "Unknown",
							},
							{
								label: "Genres",
								value: data.genres?.map((g) => g.name).join(", ") || "N/A",
							},
						]}
					/>

					<FriendWatchers mediaType="show" mediaId={id} />

					<WatchProviders mediaType="show" mediaId={id} />

					{seasons.length > 0 ? (
						<View className="gap-2 px-4">
							<Text className="font-display font-semibold text-base text-foreground">
								Seasons
							</Text>
							{seasons.map((s) => (
								<SeasonCard
									key={s.id}
									actions
									season={{
										showId,
										seasonNumber: s.season_number,
										name: s.name,
										posterPath: s.poster_path,
										episodeCount: s.episode_count,
										year: yearFromDate(s.air_date),
									}}
								/>
							))}
						</View>
					) : null}

					<CastSection cast={data.credits?.cast} />
					<CrewSection crew={data.credits?.crew} />
					<CommunityReviews
						mediaType="show"
						mediaId={id}
						scrollRef={scrollRef}
						focusReviewId={reviewId}
					/>
					<SimilarMedia mediaType="show" mediaId={id} />
				</ScrollView>
			)}
		</View>
	);
}
