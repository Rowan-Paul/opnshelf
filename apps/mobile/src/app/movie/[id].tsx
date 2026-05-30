import { moviesControllerGetMovieDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CastSection, CrewSection } from "@/components/detail/CreditsSection";
import { DetailHero } from "@/components/detail/DetailHero";
import { FriendWatchers } from "@/components/detail/FriendWatchers";
import { MediaTrackingActions } from "@/components/detail/MediaTrackingActions";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { YourNote } from "@/components/detail/YourNote";
import { YourReviews } from "@/components/detail/YourReviews";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
	backdropUrl,
	formatRuntime,
	posterUrl,
	yearFromDate,
} from "@/lib/tmdb";

export default function MovieDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const insets = useSafeAreaInsets();

	const { data, isLoading, isError } = useQuery({
		...moviesControllerGetMovieDetailsOptions({ path: { movieId: id } }),
		enabled: Boolean(id),
	});

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
			<Stack.Screen options={{ headerShown: false }} />
			{isLoading ? (
				<LoadingState />
			) : isError || !data ? (
				<ErrorState message="Couldn't load this movie." />
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-6 pb-12"
					showsVerticalScrollIndicator={false}
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

					<MediaTrackingActions mediaType="movie" movieId={id} />

					<FriendWatchers mediaType="movie" mediaId={id} />

					<OverviewSection text={data.overview} />
					<CastSection cast={data.credits?.cast} />
					<CrewSection crew={data.credits?.crew} />
					<YourReviews mediaType="movie" mediaId={id} />
					<YourNote mediaType="movie" mediaId={id} />
				</ScrollView>
			)}
		</View>
	);
}
