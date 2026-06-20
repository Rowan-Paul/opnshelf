import { showsControllerGetSeasonDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { EpisodeCard } from "@/components/detail/EpisodeCard";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { yearFromDate } from "@/lib/tmdb";

export default function SeasonDetailScreen() {
	const { id, seasonNumber } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
	}>();
	const showId = Number(id);

	const { data, isLoading, isError } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId: id, seasonNumber },
		}),
		enabled: Boolean(id) && Boolean(seasonNumber),
	});

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: data?.name ?? "Season" }}
			/>
			{isLoading ? (
				<LoadingState />
			) : isError || !data ? (
				<ErrorState message="Couldn't load this season." />
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-4 px-4 pb-12 pt-2"
					showsVerticalScrollIndicator={false}
				>
					<View>
						<Text className="font-bold font-display text-foreground text-xl">
							{data.name}
						</Text>
						{yearFromDate(data.air_date) ? (
							<Text className="mt-0.5 text-muted-foreground text-sm">
								{yearFromDate(data.air_date)} · {data.episodes.length} episodes
							</Text>
						) : (
							<Text className="mt-0.5 text-muted-foreground text-sm">
								{data.episodes.length} episodes
							</Text>
						)}
					</View>

					<OverviewSection text={data.overview} />

					{data.episodes.length === 0 ? (
						<EmptyState
							title="No episodes"
							message="This season has no episodes yet."
						/>
					) : (
						<View className="gap-2">
							{data.episodes.map((ep) => (
								<EpisodeCard
									key={ep.id}
									episode={{
										showId,
										seasonNumber: ep.season_number,
										episodeNumber: ep.episode_number,
										name: ep.name,
										overview: ep.overview,
										stillPath: ep.still_path,
										airDate: yearFromDate(ep.air_date),
										rating: ep.vote_average,
									}}
								/>
							))}
						</View>
					)}

					<CommunityReviews
						mediaType="show"
						mediaId={id}
						seasonNumber={Number(seasonNumber)}
					/>
				</ScrollView>
			)}
		</View>
	);
}
