import type { PersonFilmographyItemDto } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { DetailColumns } from "@/components/detail/DetailColumns";
import { FilmographyCard } from "@/components/person/FilmographyCard";
import { PersonHero } from "@/components/person/PersonHero";
import { PosterGridSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { usePersonDetails, usePersonFilmography } from "@/lib/use-person";
import { ShowProgressScope } from "@/lib/use-show-progress";
import { useTwStyle } from "@/lib/use-tw-style";
import { useWideLayout } from "@/lib/use-wide-layout";
import { useThemeColors } from "@/theme/colors";

function sortByDateDesc(items: PersonFilmographyItemDto[]) {
	return [...items].sort((a, b) => {
		const dateA = a.release_date || a.first_air_date || "";
		const dateB = b.release_date || b.first_air_date || "";
		return dateB.localeCompare(dateA);
	});
}

export default function PersonDetailScreen() {
	const colors = useThemeColors();
	const { id } = useLocalSearchParams<{ id: string }>();
	const gridStyle = useTwStyle("px-3 pb-12");
	const wide = useWideLayout();
	const gridColumns = useMediaCardColumns();
	const numColumns = wide ? 2 : gridColumns;

	const { data: person, isLoading, isError } = usePersonDetails(id);
	const {
		data: filmographyData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = usePersonFilmography(id);

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
		<ShowProgressScope
			showIds={filmography
				.filter((item) => item.media_type !== "movie")
				.map((item) => item.id)}
		>
			<View className="flex-1 bg-background">
				<Stack.Screen
					options={{ headerShown: true, title: person?.name ?? "Person" }}
				/>
				{isLoading ? (
					<DetailColumns
						primary={
							<View className="gap-6 px-4 pt-4">
								{/* Mirrors PersonHero: portrait + name/department lines. */}
								<View className="flex-row gap-4">
									<View className="h-40 w-28 rounded-lg bg-background-subtle" />
									<View className="flex-1 justify-end gap-2 pb-1">
										<View className="h-6 w-3/4 rounded bg-background-subtle" />
										<View className="h-5 w-1/3 rounded-full bg-background-subtle" />
									</View>
								</View>
								{/* Biography lines. */}
								<View className="gap-2">
									<View className="h-3 w-full rounded bg-background-subtle" />
									<View className="h-3 w-full rounded bg-background-subtle" />
									<View className="h-3 w-2/3 rounded bg-background-subtle" />
								</View>
							</View>
						}
						secondary={
							<View className="px-4">
								<PosterGridSkeleton columns={numColumns} />
							</View>
						}
					/>
				) : isError || !person ? (
					<ErrorState message="Couldn't load this person." />
				) : (
					<DetailColumns
						primary={
							<View className="gap-6 pt-2">
								<PersonHero person={person} />
								{person.biography ? (
									<View className="px-4">
										<Text className="mb-2 text-display-3 text-foreground">
											Biography
										</Text>
										<Text className="text-muted-foreground text-sm leading-5">
											{person.biography}
										</Text>
									</View>
								) : null}
							</View>
						}
						secondary={null}
						renderContent={(header) => (
							<FlashList
								key={`grid-${numColumns}`}
								data={filmography}
								numColumns={numColumns}
								keyExtractor={(item, index) =>
									`${item.media_type}-${item.id}-${index}`
								}
								renderItem={({ item }) => (
									<View className="flex-1 px-1 pb-3">
										<FilmographyCard item={item} />
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
										{header}

										{knownFor.length > 0 ? (
											<View>
												<Text className="mb-3 px-4 text-display-3 text-foreground">
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
															<FilmographyCard item={item} />
														</View>
													))}
												</ScrollView>
											</View>
										) : null}

										<Text className="px-4 text-display-3 text-foreground">
											Filmography
										</Text>
									</View>
								}
								ListFooterComponent={
									isFetchingNextPage ? (
										<View className="py-6">
											<ActivityIndicator color={colors.mutedForeground} />
										</View>
									) : null
								}
							/>
						)}
					/>
				)}
			</View>
		</ShowProgressScope>
	);
}
