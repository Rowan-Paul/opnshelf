import {
	type GenreDiscovery,
	moviesControllerDiscoverMoviesInfiniteOptions,
	showsControllerDiscoverShowsInfiniteOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useIsFocused } from "expo-router";
import { Pressable, RefreshControl, View } from "react-native";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { canLoadMore, LoadMoreFooter } from "@/components/ui/load-more";
import { Screen } from "@/components/ui/screen";
import { PosterGridSkeleton } from "@/components/ui/skeletons";
import { ErrorState, StaleDataNotice } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { ShowProgressScope } from "@/lib/use-show-progress";
import { useTwStyle } from "@/lib/use-tw-style";

const nextPage = (page: { page: number; hasNextPage: boolean }) =>
	page.hasNextPage ? page.page + 1 : undefined;

export function GenreDiscover({ filter }: { filter: GenreDiscovery }) {
	const isFocused = useIsFocused();
	const columns = useMediaCardColumns();
	const gridStyle = useTwStyle("px-3 pb-8");
	const movies = useInfiniteQuery({
		...moviesControllerDiscoverMoviesInfiniteOptions({
			query: { genreId: filter.genre },
		}),
		initialPageParam: 1,
		getNextPageParam: nextPage,
		enabled: isFocused && filter.type === "movies",
	});
	const shows = useInfiniteQuery({
		...showsControllerDiscoverShowsInfiniteOptions({
			query: { genreId: filter.genre },
		}),
		initialPageParam: 1,
		getNextPageParam: nextPage,
		enabled: isFocused && filter.type === "shows",
	});
	const query = filter.type === "movies" ? movies : shows;
	const items: MediaCardItem[] =
		filter.type === "movies"
			? (movies.data?.pages.flatMap((page) =>
					page.items.map((item) => ({
						id: item.id,
						type: "movie",
						title: item.title,
						posterPath: item.poster_path,
						rating: item.vote_average,
					})),
				) ?? [])
			: (shows.data?.pages.flatMap((page) =>
					page.items.map((item) => ({
						id: item.id,
						type: "show",
						title: item.name,
						posterPath: item.poster_path,
						rating: item.vote_average,
					})),
				) ?? []);
	const unique = [...new Map(items.map((item) => [item.id, item])).values()];
	return (
		<Screen className="px-0">
			<View className="gap-2 px-4 py-3">
				<Text className="text-muted-foreground text-sm">Discover</Text>
				<Text className="font-bold font-display text-2xl">
					{filter.genreName
						? `${filter.genreName} ${filter.type}`
						: `${filter.type === "movies" ? "Movies" : "Shows"} by genre`}
				</Text>
				<Pressable
					accessibilityRole="button"
					onPress={() => router.replace("/search")}
					className="self-start rounded-lg border border-border px-3 py-2"
				>
					<Text className="text-primary">Clear genre</Text>
				</Pressable>
			</View>
			{query.isPending ? (
				<View className="px-3">
					<PosterGridSkeleton columns={columns} />
				</View>
			) : query.isError && !query.data ? (
				<ErrorState
					message="Couldn’t load this genre."
					onRetry={() => void query.refetch()}
				/>
			) : (
				<ShowProgressScope
					showIds={filter.type === "shows" ? unique.map((item) => item.id) : []}
				>
					{query.isRefetchError ? (
						<StaleDataNotice
							message="Couldn’t refresh this genre."
							onRetry={() => void query.refetch()}
							isRetrying={query.isRefetching}
						/>
					) : null}
					<FlashList
						key={`${filter.type}-${filter.genre}-${columns}`}
						data={unique}
						numColumns={columns}
						keyExtractor={(item) => String(item.id)}
						renderItem={({ item }) => (
							<View className="flex-1 px-1 pb-3">
								<MediaCard item={item} actions />
							</View>
						)}
						contentContainerStyle={gridStyle}
						onEndReachedThreshold={0.5}
						onEndReached={() => {
							if (canLoadMore(query)) void query.fetchNextPage();
						}}
						refreshControl={
							<RefreshControl
								refreshing={query.isRefetching}
								onRefresh={() => void query.refetch()}
								tintColor="#f3bc00"
								colors={["#f3bc00"]}
							/>
						}
						ListEmptyComponent={
							<Text className="px-4 py-16 text-center text-muted-foreground">
								No {filter.type} found in this genre.
							</Text>
						}
						ListFooterComponent={
							<LoadMoreFooter
								isFetchingNextPage={query.isFetchingNextPage}
								isFetchNextPageError={query.isFetchNextPageError}
								onRetry={() => void query.fetchNextPage()}
								skeleton={<PosterGridSkeleton rows={1} columns={columns} />}
							/>
						}
					/>
				</ShowProgressScope>
			)}
		</Screen>
	);
}
