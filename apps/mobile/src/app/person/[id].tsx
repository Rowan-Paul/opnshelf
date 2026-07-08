import type { PersonFilmographyItemDto } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { FilmographyCard } from "@/components/person/FilmographyCard";
import { PersonHero } from "@/components/person/PersonHero";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useMovieWatchToggle } from "@/lib/use-movie-watch-toggle";
import { usePersonDetails, usePersonFilmography } from "@/lib/use-person";
import { useTwStyle } from "@/lib/use-tw-style";

function sortByDateDesc(items: PersonFilmographyItemDto[]) {
	return [...items].sort((a, b) => {
		const dateA = a.release_date || a.first_air_date || "";
		const dateB = b.release_date || b.first_air_date || "";
		return dateB.localeCompare(dateA);
	});
}

export default function PersonDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const gridStyle = useTwStyle("px-3 pb-12");

	const { data: person, isLoading, isError } = usePersonDetails(id);
	const {
		data: filmographyData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = usePersonFilmography(id);

	const { isAuthenticated, isWatched, toggle } = useMovieWatchToggle();

	const filmography = useMemo(() => {
		const items = filmographyData?.pages.flatMap((page) => page.items) ?? [];
		return sortByDateDesc(items);
	}, [filmographyData]);

	const knownFor = useMemo(
		() =>
			[...filmography]
				.filter((item) => (item.vote_average ?? 0) > 0)
				.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
				.slice(0, 6),
		[filmography],
	);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: person?.name ?? "Person" }}
			/>
			{isLoading ? (
				<LoadingState />
			) : isError || !person ? (
				<ErrorState message="Couldn't load this person." />
			) : (
				<FlashList
					data={filmography}
					numColumns={3}
					keyExtractor={(item, index) =>
						`${item.media_type}-${item.id}-${index}`
					}
					renderItem={({ item }) => (
						<View className="flex-1 px-1 pb-3">
							<FilmographyCard
								item={item}
								canToggle={isAuthenticated}
								watched={item.media_type === "movie" && isWatched(item.id)}
								onToggleWatched={(it) => toggle(it.id)}
							/>
						</View>
					)}
					contentContainerStyle={gridStyle}
					showsVerticalScrollIndicator={false}
					onEndReachedThreshold={0.5}
					onEndReached={() => {
						if (hasNextPage && !isFetchingNextPage) fetchNextPage();
					}}
					ListHeaderComponent={
						<View className="gap-6 pb-2">
							<PersonHero person={person} />

							{person.biography ? (
								<View className="px-4">
									<Text className="mb-2 font-display font-semibold text-base text-foreground">
										Biography
									</Text>
									<Text className="text-muted-foreground text-sm leading-5">
										{person.biography}
									</Text>
								</View>
							) : null}

							{knownFor.length > 0 ? (
								<View>
									<Text className="mb-3 px-4 font-display font-semibold text-base text-foreground">
										Known for
									</Text>
									{/* items-start: horizontal ScrollView content defaults to
									    cross-axis stretch, collapsing aspect-ratio cards */}
									<ScrollView
										horizontal
										showsHorizontalScrollIndicator={false}
										contentContainerClassName="items-start gap-3 px-4"
									>
										{knownFor.map((item) => (
											<View
												key={`known-${item.media_type}-${item.id}`}
												className="w-28"
											>
												<FilmographyCard
													item={item}
													canToggle={isAuthenticated}
													watched={
														item.media_type === "movie" && isWatched(item.id)
													}
													onToggleWatched={(it) => toggle(it.id)}
												/>
											</View>
										))}
									</ScrollView>
								</View>
							) : null}

							<Text className="px-4 font-display font-semibold text-base text-foreground">
								Filmography
							</Text>
						</View>
					}
					ListFooterComponent={
						isFetchingNextPage ? (
							<View className="py-6">
								<ActivityIndicator color="#94a3b8" />
							</View>
						) : null
					}
				/>
			)}
		</View>
	);
}
