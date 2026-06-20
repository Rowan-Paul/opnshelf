import { showsControllerGetSeasonDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Check, Eye } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { AddToListButton } from "@/components/detail/AddToListButton";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import { EpisodeCard } from "@/components/detail/EpisodeCard";
import { NoteButton } from "@/components/detail/NoteButton";
import { OverviewSection } from "@/components/detail/OverviewSection";
import { RatingButton } from "@/components/detail/RatingButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { yearFromDate } from "@/lib/tmdb";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";

export default function SeasonDetailScreen() {
	const { id, seasonNumber } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
	}>();
	const showId = Number(id);
	const seasonNum = Number(seasonNumber);
	const { isAuthenticated } = useAuth();

	const watchStatus = useWatchStatus({ mediaType: "show", showId: id });
	const { markSeasonWatched, isMarkSeasonPending } = useWatchActions({
		mediaType: "show",
		showId: id,
	});

	const { data, isLoading, isError } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId: id, seasonNumber },
		}),
		enabled: Boolean(id) && Boolean(seasonNumber),
	});

	const totalEpisodes = data?.episodes.length ?? 0;
	const episodesWatched =
		data?.episodes.filter((ep) =>
			watchStatus.isEpisodeWatched?.(ep.season_number, ep.episode_number),
		).length ?? 0;
	const seasonComplete = totalEpisodes > 0 && episodesWatched >= totalEpisodes;

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

					{isAuthenticated ? (
						<View className="-mx-4 gap-2">
							<Pressable
								onPress={() => markSeasonWatched(seasonNum)}
								disabled={isMarkSeasonPending}
								className={
									seasonComplete
										? "mx-4 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card py-3"
										: "mx-4 flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3"
								}
								style={{ opacity: isMarkSeasonPending ? 0.7 : 1 }}
							>
								{seasonComplete ? (
									<>
										<View className="rounded-full bg-primary/20 p-1">
											<Check color="#22c55e" size={14} />
										</View>
										<Text className="font-semibold text-foreground">
											{episodesWatched} / {totalEpisodes} watched
										</Text>
									</>
								) : (
									<>
										<Eye color="#3f2e00" size={18} />
										<Text className="font-semibold text-primary-foreground">
											Mark season watched
										</Text>
									</>
								)}
							</Pressable>
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
					) : null}

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
