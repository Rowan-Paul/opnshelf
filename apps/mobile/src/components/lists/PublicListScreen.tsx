import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
import { List as ListIcon } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { ListInfoCard } from "@/components/lists/ListInfoCard";
import {
	LIST_EMPTY_TITLE,
	LIST_NO_MATCHES_MESSAGE,
	LIST_NO_MATCHES_TITLE,
	ListItemsToolbar,
	useListItemsFilter,
} from "@/components/lists/ListItemsToolbar";
import { ListSortSheet } from "@/components/lists/ListSortSheet";
import { MediaCard } from "@/components/media/MediaCard";
import { PosterGridSkeleton } from "@/components/ui/skeletons";
import {
	EmptyState,
	ErrorState,
	StaleDataNotice,
} from "@/components/ui/states";
import { useAuth } from "@/lib/auth-context";
import { listItemToMediaCardItem } from "@/lib/list-media";
import type { ListSort } from "@/lib/use-lists";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { useProfileList, usePublicProfile } from "@/lib/use-public-profile";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { ShowProgressScope } from "@/lib/use-show-progress";
import { useTwStyle } from "@/lib/use-tw-style";
import { useThemeColors } from "@/theme/colors";

/**
 * Read-only List screen for someone else's List, rendered by
 * `/profile/[handle]/lists/[slug]` when the viewer doesn't own it.
 *
 * The `[handle]` segment may be a real AT Protocol handle or a raw DID — the
 * profile Lists tab links here with the owner's handle, but older deep links
 * carry a DID. When it's already a DID we use it directly; otherwise we resolve
 * it to a DID via the public profile query (`usePublicProfile` is keyed by
 * handle), mirroring how the profile screen itself resolves a handle.
 *
 * Search, sort and the media filters are open to every viewer, as on Web;
 * only Reorder, Add and Edit stay on the owner screen.
 */
export function PublicListScreen() {
	const themeColors = useThemeColors();
	const { handle: handleParam, slug } = useLocalSearchParams<{
		handle: string;
		slug: string;
	}>();
	const gridStyle = useTwStyle("px-3 pb-12");
	const { refreshing, onRefresh } = useRefreshActiveQueries();
	const { isAuthenticated, user } = useAuth();

	const segment = handleParam ? decodeURIComponent(handleParam) : "";
	const isDid = segment.startsWith("did:");
	const numColumns = useMediaCardColumns();

	// Only hit the profile endpoint when the segment is a handle, not a DID.
	const profileQuery = usePublicProfile(isDid ? "" : segment);
	const userDid = isDid ? segment : (profileQuery.data?.did ?? "");

	// "Created by you" is noise on your own list, and a raw DID from an older
	// deep link names nobody a reader recognises. Web hides the line for the
	// owner too, so both clients render the same card.
	const creator =
		isDid || (!!user?.did && user.did === userDid) ? undefined : segment;

	const [sort, setSort] = useState<ListSort>("position");
	const [sortVisible, setSortVisible] = useState(false);

	// A renamed list regenerates its slug, so a shared link can outlive the
	// list it points at. That reads as missing, not as a broken app.
	const {
		list,
		items,
		isLoading,
		isError,
		isNotFound,
		refetch,
		isFetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useProfileList(userDid, slug ?? "", sort);
	const { filter, setFilter, search, setSearch, filteredItems, isFiltered } =
		useListItemsFilter(items, {
			hasNextPage,
			isFetchingNextPage,
			fetchNextPage,
		});
	const resolvingHandle = !isDid && profileQuery.isLoading;
	const handleError = !isDid && profileQuery.isError;

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: list?.name ?? "List" }}
			/>

			{/* A failed refetch keeps the last data, so the grid below still holds
			    the list the reader came for. */}
			{isError && list ? (
				<StaleDataNotice
					isRetrying={isFetching}
					message="Couldn't refresh this list. Showing what loaded last."
					onRetry={() => refetch()}
				/>
			) : null}

			{resolvingHandle || isLoading ? (
				<View className="px-3 pt-3">
					<PosterGridSkeleton columns={numColumns} />
				</View>
			) : isNotFound ? (
				<EmptyState
					icon={ListIcon}
					title="List not found"
					message="This list doesn't exist, or it isn't public."
				/>
			) : handleError || !list ? (
				<ErrorState message="Couldn't load this list." />
			) : (
				<ShowProgressScope
					showIds={filteredItems
						.filter(
							(item) =>
								item.mediaType === "show" &&
								item.seasonNumber == null &&
								item.episodeNumber == null,
						)
						.map((item) => item.mediaId)}
				>
					<FlashList
						key={`grid-${numColumns}`}
						data={filteredItems}
						numColumns={numColumns}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => (
							<View className="flex-1 px-1 pb-3">
								<MediaCard
									item={listItemToMediaCardItem(item)}
									actions
									watchCount={item.watchCount}
								/>
							</View>
						)}
						contentContainerStyle={gridStyle}
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								tintColor={themeColors.accent}
								colors={[themeColors.accent]}
							/>
						}
						onEndReachedThreshold={0.5}
						onEndReached={() => {
							if (hasNextPage && !isFetchingNextPage) fetchNextPage();
						}}
						ListHeaderComponent={
							<View className="gap-3 px-1 pb-4">
								<ListInfoCard
									isOwner={!!user?.did && user.did === userDid}
									{...list}
									creator={creator}
									showProgress={isAuthenticated && list.total > 0}
								/>

								<ListItemsToolbar
									search={search}
									onSearchChange={setSearch}
									sort={sort}
									onSortPress={() => setSortVisible(true)}
									filter={filter}
									onFilterChange={setFilter}
								/>
							</View>
						}
						ListEmptyComponent={
							isFiltered ? (
								<EmptyState
									title={LIST_NO_MATCHES_TITLE}
									message={LIST_NO_MATCHES_MESSAGE}
								/>
							) : (
								<EmptyState icon={ListIcon} title={LIST_EMPTY_TITLE} />
							)
						}
						ListFooterComponent={
							// Card-shaped placeholders, not a spinner, while more load.
							isFetchingNextPage ? (
								<View className="px-3 pt-2">
									<PosterGridSkeleton rows={1} columns={numColumns} />
								</View>
							) : null
						}
					/>
				</ShowProgressScope>
			)}

			<ListSortSheet
				visible={sortVisible}
				onDismiss={() => setSortVisible(false)}
				value={sort}
				onChange={setSort}
			/>
		</View>
	);
}
