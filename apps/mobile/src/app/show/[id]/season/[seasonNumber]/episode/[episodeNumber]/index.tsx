import {
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight, Star } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { CastSection, CrewSection } from "@/components/detail/CreditsSection";
import { MediaTrackingActions } from "@/components/detail/MediaTrackingActions";
import { MetadataPills } from "@/components/detail/MetadataPills";
import { NoteButton } from "@/components/detail/NoteButton";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { RatingButton } from "@/components/detail/RatingButton";
import { SimilarMedia } from "@/components/detail/SimilarMedia";
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

	// Episode neighbours: use the show's season list (each season's
	// episode_count) to compute prev/next, hopping across season boundaries the
	// same way web does — at episode 1 go to the previous season's last episode;
	// at a season's last episode go to the next season's episode 1.
	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({ path: { showId: id } }),
		enabled: Boolean(id),
	});

	const seasons = (showData?.seasons ?? [])
		.filter((s) => s.season_number > 0)
		.sort((a, b) => a.season_number - b.season_number);
	const currentSeasonCount =
		seasons.find((s) => s.season_number === seasonNum)?.episode_count ?? 0;

	let prevEpisode: { season: number; episode: number } | null = null;
	if (episodeNum > 1) {
		prevEpisode = { season: seasonNum, episode: episodeNum - 1 };
	} else {
		const prevSeason = seasons.find((s) => s.season_number === seasonNum - 1);
		if (prevSeason) {
			prevEpisode = {
				season: prevSeason.season_number,
				episode: prevSeason.episode_count || 1,
			};
		}
	}

	let nextEpisode: { season: number; episode: number } | null = null;
	if (currentSeasonCount > 0 && episodeNum < currentSeasonCount) {
		nextEpisode = { season: seasonNum, episode: episodeNum + 1 };
	} else {
		const nextSeason = seasons.find((s) => s.season_number === seasonNum + 1);
		if (nextSeason) {
			nextEpisode = { season: nextSeason.season_number, episode: 1 };
		}
	}

	const goToEpisode = (target: { season: number; episode: number }) => {
		router.push(
			`/show/${id}/season/${target.season}/episode/${target.episode}` as const,
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

						<View className="-mx-4 gap-2">
							<MediaTrackingActions
								mediaType="episode"
								showId={id}
								seasonNumber={seasonNum}
								episodeNumber={episodeNum}
							/>
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

					<OverviewSection text={data.overview} />
					<CastSection cast={data.guest_stars} />
					<CrewSection crew={data.crew} />
					<CommunityReviews
						mediaType="show"
						mediaId={id}
						seasonNumber={seasonNum}
						episodeNumber={episodeNum}
					/>
					<SimilarMedia mediaType="show" mediaId={id} />

					<View className="flex-row gap-2 px-4">
						<Pressable
							onPress={() => prevEpisode && goToEpisode(prevEpisode)}
							disabled={!prevEpisode}
							className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
							style={{ opacity: prevEpisode ? 1 : 0.4 }}
						>
							<ChevronLeft color="#94a3b8" size={18} />
							<Text className="font-semibold text-foreground">Previous</Text>
						</Pressable>
						<Pressable
							onPress={() => nextEpisode && goToEpisode(nextEpisode)}
							disabled={!nextEpisode}
							className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
							style={{ opacity: nextEpisode ? 1 : 0.4 }}
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
