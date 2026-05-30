import { showsControllerGetShowDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CastSection } from "@/components/detail/CreditsSection";
import { DetailHero } from "@/components/detail/DetailHero";
import { FriendWatchers } from "@/components/detail/FriendWatchers";
import { MediaTrackingActions } from "@/components/detail/MediaTrackingActions";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { SeasonCard } from "@/components/detail/SeasonCard";
import { YourReviews } from "@/components/detail/YourReviews";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { backdropUrl, posterUrl, yearFromDate } from "@/lib/tmdb";

export default function ShowDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const insets = useSafeAreaInsets();
	const showId = Number(id);

	const { data, isLoading, isError } = useQuery({
		...showsControllerGetShowDetailsOptions({ path: { showId: id } }),
		enabled: Boolean(id),
	});

	// Hide the placeholder "Season 0" specials when there are real seasons.
	const seasons = (data?.seasons ?? []).filter(
		(s) => s.season_number > 0 || (data?.seasons?.length ?? 0) === 1,
	);

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
			<Stack.Screen options={{ headerShown: false }} />
			{isLoading ? (
				<LoadingState />
			) : isError || !data ? (
				<ErrorState message="Couldn't load this show." />
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-6 pb-12"
					showsVerticalScrollIndicator={false}
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

					<MediaTrackingActions mediaType="show" showId={id} />

					<FriendWatchers mediaType="show" mediaId={id} />

					<OverviewSection text={data.overview} />

					{seasons.length > 0 ? (
						<View className="gap-2 px-4">
							<Text className="font-display font-semibold text-base text-foreground">
								Seasons
							</Text>
							{seasons.map((s) => (
								<SeasonCard
									key={s.id}
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
					<YourReviews mediaType="show" mediaId={id} />
				</ScrollView>
			)}
		</View>
	);
}
