import { moviesControllerGetMovieDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { AddToLibraryButton } from "@/components/detail/AddToLibraryButton";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { CreditsSummary } from "@/components/detail/CreditsSection";
import { DetailHero } from "@/components/detail/DetailHero";
import { DetailsCard } from "@/components/detail/DetailsCard";
import { FriendWatchers } from "@/components/detail/FriendWatchers";
import { MediaTrackingActions } from "@/components/detail/MediaTrackingActions";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { NoteButton } from "@/components/detail/NoteButton";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { RateReviewButton } from "@/components/detail/RateReviewButton";
import { ShareButton } from "@/components/detail/ShareButton";
import { SimilarMedia } from "@/components/detail/SimilarMedia";
import { WatchlistFavoritesButtons } from "@/components/detail/WatchlistFavoritesButtons";
import { WatchProviders } from "@/components/detail/WatchProviders";
import { DetailSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import {
	backdropUrl,
	formatLongDate,
	formatRuntime,
	posterUrl,
	yearFromDate,
} from "@/lib/tmdb";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { webMediaUrl } from "@/lib/web-url";

export default function MovieDetailScreen() {
	const { id, reviewId } = useLocalSearchParams<{
		id: string;
		reviewId?: string;
	}>();
	const scrollRef = useRef<ScrollView>(null);

	const { data, isLoading, isError } = useQuery({
		...moviesControllerGetMovieDetailsOptions({ path: { movieId: id } }),
		enabled: Boolean(id),
	});
	const { refreshing, onRefresh } = useRefreshActiveQueries();

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: data?.title ?? "Movie" }}
			/>
			{isLoading ? (
				<DetailSkeleton />
			) : isError || !data ? (
				<ErrorState message="Couldn't load this movie." />
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
						title={data.title}
						backdropUrl={backdropUrl(data.backdrop_path)}
						posterUrl={posterUrl(data.poster_path)}
						rating={data.vote_average}
					>
						<MetadataPills
							items={[
								yearFromDate(data.release_date),
								formatRuntime(data.runtime),
								...(data.genres ?? []).map((g) => g.name),
							]}
						/>
					</DetailHero>

					{/* Shelf, watchlist and secondary tiles form one action cluster,
					    kept tight (gap-2) like the show/season/episode screens. */}
					<View className="gap-2">
						<MediaTrackingActions mediaType="movie" movieId={id} />
						<WatchlistFavoritesButtons mediaType="movie" mediaId={id} />
						{/* Secondary actions as one row of compact tiles. */}
						<View className="flex-row gap-2 px-4">
							<RateReviewButton mediaType="movie" mediaId={id} />
							<AddToListButton mediaType="movie" mediaId={id} />
							<AddToLibraryButton mediaType="movie" mediaId={id} />
							<NoteButton mediaType="movie" mediaId={id} />
							<ShareButton
								url={webMediaUrl({ type: "movie", id, name: data.title })}
								title={data.title}
							/>
						</View>
					</View>

					<OverviewSection text={data.overview} />
					<DetailsCard
						items={[
							{
								label: "Director",
								value:
									data.credits?.crew?.find((p) => p.job === "Director")?.name ||
									"Unknown",
							},
							{ label: "Runtime", value: formatRuntime(data.runtime) },
							{
								label: "Release",
								value: formatLongDate(data.release_date) ?? "Unknown",
							},
							{
								label: "Genres",
								value: data.genres?.map((g) => g.name).join(", ") || "N/A",
							},
						]}
					/>
					<FriendWatchers mediaType="movie" mediaId={id} />
					<WatchProviders mediaType="movie" mediaId={id} />
					<CreditsSummary
						credits={data.credits}
						creditsHref={`/movie/${id}/credits`}
					/>
					<CommunityReviews
						mediaType="movie"
						mediaId={id}
						scrollRef={scrollRef}
						focusReviewId={reviewId}
						mediaWebUrl={webMediaUrl({ type: "movie", id, name: data.title })}
					/>
					<SimilarMedia mediaType="movie" mediaId={id} />
				</ScrollView>
			)}
		</View>
	);
}
