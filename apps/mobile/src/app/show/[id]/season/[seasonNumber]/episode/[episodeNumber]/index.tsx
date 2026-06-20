import {
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetSeasonDetailsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight, Star } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { CastSection, CrewSection } from "@/components/detail/CreditsSection";
import { EpisodeWatchButton } from "@/components/detail/EpisodeWatchButton";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { NoteButton } from "@/components/detail/NoteButton";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { RatingButton } from "@/components/detail/RatingButton";
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
	const seasonNum = Number(seasonNumber);
	const episodeNum = Number(episodeNumber);

	const { data, isLoading, isError } = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId: id, seasonNumber, episodeNumber },
		}),
		enabled: Boolean(id) && Boolean(seasonNumber) && Boolean(episodeNumber),
	});

	// Episode neighbours: the season detail already lists every episode, so we
	// reuse it to know the current episode's siblings. Navigation stays within
	// the current season (no cross-season hop at the season boundary).
	const { data: seasonData } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId: id, seasonNumber },
		}),
		enabled: Boolean(id) && Boolean(seasonNumber),
	});

	const seasonEpisodeCount = seasonData?.episodes.length ?? 0;
	const hasPrev = episodeNum > 1;
	const hasNext = seasonEpisodeCount > 0 && episodeNum < seasonEpisodeCount;

	const goToEpisode = (nextEpisode: number) => {
		router.push(
			`/show/${id}/season/${seasonNumber}/episode/${nextEpisode}` as const,
		);
	};

	return (
		<View className="flex-1 bg-background">
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

						<View className="gap-2">
							<EpisodeWatchButton
								showId={id}
								seasonNumber={seasonNum}
								episodeNumber={episodeNum}
							/>
							<View className="-mx-4 gap-2">
								<RatingButton
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
							</View>
						</View>
					</View>

					<OverviewSection text={data.overview} />
					<CastSection cast={data.guest_stars} />
					<CrewSection crew={data.crew} />
					<CommunityReviews
						mediaType="show"
						mediaId={id}
						seasonNumber={seasonNum}
						episodeNumber={episodeNum}
					/>

					<View className="flex-row gap-2 px-4">
						<Pressable
							onPress={() => goToEpisode(episodeNum - 1)}
							disabled={!hasPrev}
							className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
							style={{ opacity: hasPrev ? 1 : 0.4 }}
						>
							<ChevronLeft color="#94a3b8" size={18} />
							<Text className="font-semibold text-foreground">Previous</Text>
						</Pressable>
						<Pressable
							onPress={() => goToEpisode(episodeNum + 1)}
							disabled={!hasNext}
							className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
							style={{ opacity: hasNext ? 1 : 0.4 }}
						>
							<Text className="font-semibold text-foreground">Next</Text>
							<ChevronRight color="#94a3b8" size={18} />
						</Pressable>
					</View>
				</ScrollView>
			)}
		</View>
	);
}
