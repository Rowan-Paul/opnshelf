import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { CastSection, CrewSection } from "@/components/detail/CreditsSection";
import { EpisodeCard } from "@/components/detail/EpisodeCard";
import { MediaTrackingActions } from "@/components/detail/MediaTrackingActions";
import { NoteButton } from "@/components/detail/NoteButton";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { RatingButton } from "@/components/detail/RatingButton";
import { SimilarMedia } from "@/components/detail/SimilarMedia";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { yearFromDate } from "@/lib/tmdb";

export default function SeasonDetailScreen() {
	const { id, seasonNumber } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
	}>();
	const showId = Number(id);
	const seasonNum = Number(seasonNumber);

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

	const totalEpisodes = data?.episodes.length ?? 0;

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
		router.push(`/show/${id}/season/${season}` as const);
	};

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
					contentContainerClassName="gap-6 pb-12 pt-2"
					showsVerticalScrollIndicator={false}
				>
					<View className="px-4">
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

					<View className="gap-2">
						<MediaTrackingActions
							mediaType="season"
							showId={id}
							seasonNumber={seasonNum}
							episodeCount={totalEpisodes}
						/>
						<RatingButton
							mediaType="show"
							mediaId={id}
							seasonNumber={seasonNum}
						/>
						<AddToListButton
							mediaType="show"
							mediaId={id}
							seasonNumber={seasonNum}
						/>
						<NoteButton
							mediaType="show"
							mediaId={id}
							seasonNumber={seasonNum}
						/>
					</View>

					<OverviewSection text={data.overview} />

					{data.episodes.length === 0 ? (
						<EmptyState
							title="No episodes"
							message="This season has no episodes yet."
						/>
					) : (
						<View className="gap-2 px-4">
							{data.episodes.map((ep) => (
								<EpisodeCard
									key={ep.id}
									actions
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

					<CastSection cast={showData?.credits?.cast} />
					<CrewSection crew={showData?.credits?.crew} />
					<CommunityReviews
						mediaType="show"
						mediaId={id}
						seasonNumber={Number(seasonNumber)}
					/>
					<SimilarMedia mediaType="show" mediaId={id} />

					{prevSeason || nextSeason ? (
						<View className="flex-row gap-2 px-4">
							<Pressable
								onPress={() =>
									prevSeason && goToSeason(prevSeason.season_number)
								}
								disabled={!prevSeason}
								className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
								style={{ opacity: prevSeason ? 1 : 0.4 }}
							>
								<ChevronLeft color="#94a3b8" size={18} />
								<Text className="font-semibold text-foreground">
									Prev season
								</Text>
							</Pressable>
							<Pressable
								onPress={() =>
									nextSeason && goToSeason(nextSeason.season_number)
								}
								disabled={!nextSeason}
								className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-3"
								style={{ opacity: nextSeason ? 1 : 0.4 }}
							>
								<Text className="font-semibold text-foreground">
									Next season
								</Text>
								<ChevronRight color="#94a3b8" size={18} />
							</Pressable>
						</View>
					) : null}
				</ScrollView>
			)}
		</View>
	);
}
