import { moviesControllerGetMovieDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import type { ScrollViewInstance } from "react-native";
import { RefreshControl, View } from "react-native";
import { AddToLibraryButton } from "@/components/detail/AddToLibraryButton";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { CreditsSummary } from "@/components/detail/CreditsSection";
import { DetailColumns } from "@/components/detail/DetailColumns";
import { DetailHero } from "@/components/detail/DetailHero";
import { DetailsCard } from "@/components/detail/DetailsCard";
import { FriendWatchers } from "@/components/detail/FriendWatchers";
import { GenreLinks } from "@/components/detail/GenreLinks";
import { MediaTrackingActions } from "@/components/detail/MediaTrackingActions";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { NoteButton } from "@/components/detail/NoteButton";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { RateReviewButton } from "@/components/detail/RateReviewButton";
import { ShareButton } from "@/components/detail/ShareButton";
import { SimilarMedia } from "@/components/detail/SimilarMedia";
import { WatchlistFavoritesButtons } from "@/components/detail/WatchlistFavoritesButtons";
import { WatchProviders } from "@/components/detail/WatchProviders";
import { ScreenFrame } from "@/components/ui/screen-frame";
import { DetailSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import {
	backdropUrl,
	formatLongDate,
	formatRuntime,
	posterUrl,
	yearFromDate,
} from "@/lib/tmdb";
import { useMediaRating } from "@/lib/use-media-rating";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { webMediaUrl } from "@/lib/web-url";
import { useThemeColors } from "@/theme/colors";

export default function MovieDetailScreen() {
	const themeColors = useThemeColors();
	const { id, name, reviewId } = useLocalSearchParams<{
		id: string;
		// The slug segment, carried into child links so in-app navigation
		// produces the same URLs the Web App does (ADR 0023).
		name: string;
		reviewId?: string;
	}>();
	const scrollRef = useRef<ScrollViewInstance>(null);

	const { data, isLoading, isError } = useQuery({
		...moviesControllerGetMovieDetailsOptions({ path: { movieId: id } }),
		enabled: Boolean(id),
	});
	const { data: mediaRating } = useMediaRating({
		mediaType: "movie",
		mediaId: id,
	});
	const rating = mediaRating?.averageRating ?? data?.vote_average;
	const { refreshing, onRefresh } = useRefreshActiveQueries();

	return (
		<ScreenFrame>
			<Stack.Screen
				options={{ headerShown: true, title: data?.title ?? "Movie" }}
			/>
			{isLoading ? (
				<DetailSkeleton />
			) : isError || !data ? (
				<ErrorState message="Couldn't load this movie." />
			) : (
				<DetailColumns
					primary={
						<>
							<DetailHero
								title={data.title}
								backdropUrl={backdropUrl(data.backdrop_path)}
								posterUrl={posterUrl(data.poster_path)}
								rating={rating}
							>
								<MetadataPills
									items={[
										yearFromDate(data.release_date),
										formatRuntime(data.runtime),
									]}
								/>
								<GenreLinks genres={data.genres} mediaType="movie" />
							</DetailHero>

							{/* Shelf, watchlist and secondary tiles form one action cluster,
					    kept tight (gap-2) like the show/season/episode screens. */}
							<View className="gap-2">
								<MediaTrackingActions
									mediaType="movie"
									movieId={id}
									title={data.title}
								/>
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
						</>
					}
					secondary={
						<>
							<OverviewSection text={data.overview} />
							<DetailsCard
								items={[
									{
										label: "Director",
										value:
											data.credits?.crew?.find((p) => p.job === "Director")
												?.name || "Unknown",
									},
									{ label: "Runtime", value: formatRuntime(data.runtime) },
									{
										label: "Release",
										value: formatLongDate(data.release_date) ?? "Unknown",
									},
									{
										label: "Genres",
										value: data.genres?.length ? (
											<GenreLinks
												genres={data.genres}
												mediaType="movie"
												compact
											/>
										) : (
											"N/A"
										),
									},
								]}
							/>

							<FriendWatchers mediaType="movie" mediaId={id} />
							<WatchProviders mediaType="movie" mediaId={id} />
							<CreditsSummary
								credits={data.credits}
								creditsHref={`/movies/${id}/${name}/credits`}
							/>
							<CommunityReviews
								mediaType="movie"
								mediaId={id}
								scrollRef={scrollRef}
								focusReviewId={reviewId}
								mediaWebUrl={webMediaUrl({
									type: "movie",
									id,
									name: data.title,
								})}
							/>
							<SimilarMedia mediaType="movie" mediaId={id} />
						</>
					}
					scrollRef={scrollRef}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							tintColor={themeColors.accent}
							colors={[themeColors.accent]}
						/>
					}
				/>
			)}
		</ScreenFrame>
	);
}
