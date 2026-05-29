import { showsControllerGetEpisodeDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Star } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CastSection, CrewSection } from "@/components/detail/CreditsSection";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { PosterImage } from "@/components/media/PosterImage";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { formatRuntime, stillUrl, yearFromDate } from "@/lib/tmdb";

export default function EpisodeDetailScreen() {
	const { id, seasonNumber, episodeNumber } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
		episodeNumber: string;
	}>();
	const insets = useSafeAreaInsets();

	const { data, isLoading, isError } = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId: id, seasonNumber, episodeNumber },
		}),
		enabled: Boolean(id) && Boolean(seasonNumber) && Boolean(episodeNumber),
	});

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
			<Stack.Screen
				options={{ headerShown: true, title: data?.name ?? "Episode" }}
			/>
			{isLoading ? (
				<LoadingState />
			) : isError || !data ? (
				<ErrorState message="Couldn't load this episode." />
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-6 pb-12"
					showsVerticalScrollIndicator={false}
				>
					<View className="aspect-video w-full bg-background-subtle">
						<PosterImage
							url={stillUrl(data.still_path, "w780")}
							className="aspect-video w-full"
						/>
					</View>

					<View className="gap-3 px-4">
						<View>
							<Text className="text-muted-foreground text-xs">
								Season {data.season_number} · Episode {data.episode_number}
							</Text>
							<Text className="mt-0.5 font-bold font-display text-foreground text-xl">
								{data.name}
							</Text>
						</View>

						{data.vote_average && data.vote_average > 0 ? (
							<View className="flex-row items-center gap-1">
								<Star color="#f3bc00" fill="#f3bc00" size={14} />
								<Text className="font-medium text-foreground text-sm">
									{data.vote_average.toFixed(1)}
								</Text>
							</View>
						) : null}

						<MetadataPills
							items={[yearFromDate(data.air_date), formatRuntime(data.runtime)]}
						/>
					</View>

					<OverviewSection text={data.overview} />
					<CastSection cast={data.guest_stars} />
					<CrewSection crew={data.crew} />
				</ScrollView>
			)}
		</View>
	);
}
