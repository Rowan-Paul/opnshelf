import {
	type FollowedActivityItemDto,
	socialControllerGetFeedInfiniteOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityCard } from "@/components/social/ActivityCard";
import { CircleFilterBar } from "@/components/social/CircleFilterBar";
import { ReviewsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useCircles } from "@/lib/use-circles";
import { useTwStyle } from "@/lib/use-tw-style";

const PAGE_SIZE = 20;

/**
 * Activity tab: the full friends activity feed (people you follow). The home
 * dashboard shows a 5-item preview of the same `socialControllerGetFeed`
 * procedure; this screen renders the whole feed with infinite scroll and
 * pull-to-refresh. Each entry is a standalone card. Mirrors the web feed but as
 * a first-class bottom-tab destination (replaces the old Shelf tab).
 */
export default function ActivityScreen() {
	const insets = useSafeAreaInsets();
	const [refreshing, setRefreshing] = useState(false);
	const listStyle = useTwStyle("px-4 pb-8");

	const { data: circles = [] } = useCircles();
	const [activeCircleId, setActiveCircleId] = useState<string | undefined>();

	// If the selected circle was deleted elsewhere, fall back to the full feed.
	useEffect(() => {
		if (activeCircleId && !circles.some((c) => c.id === activeCircleId)) {
			setActiveCircleId(undefined);
		}
	}, [activeCircleId, circles]);

	const {
		data,
		isLoading,
		isError,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		refetch,
	} = useInfiniteQuery({
		...socialControllerGetFeedInfiniteOptions({
			query: { pageSize: PAGE_SIZE, circleId: activeCircleId },
		}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});

	const items: FollowedActivityItemDto[] =
		data?.pages.flatMap((page) => page.items) ?? [];

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={onRefresh}
			tintColor="#f3bc00"
			colors={["#f3bc00"]}
		/>
	);

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
			<View className="px-4 pt-3 pb-3">
				<Text className="font-bold font-display text-2xl text-foreground">
					Activity
				</Text>
				<Text className="text-muted-foreground text-sm">
					Recent watches and reviews from people you follow
				</Text>
			</View>

			{circles.length > 0 ? (
				<CircleFilterBar
					circles={circles}
					activeCircleId={activeCircleId}
					onSelect={setActiveCircleId}
				/>
			) : null}

			{isLoading ? (
				<View className="px-4 pt-3">
					<ReviewsSkeleton rows={3} />
				</View>
			) : isError ? (
				<ErrorState message="Couldn't load activity. Pull to retry." />
			) : items.length === 0 ? (
				<EmptyState
					icon={MessageCircle}
					title="No activity yet"
					message="Follow people and their watches and reviews will show up here."
				/>
			) : (
				<FlashList
					data={items}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => <ActivityCard activity={item} />}
					ItemSeparatorComponent={() => <View className="h-5" />}
					contentContainerStyle={listStyle}
					refreshControl={refreshControl}
					onEndReachedThreshold={0.5}
					onEndReached={() => {
						if (hasNextPage && !isFetchingNextPage) fetchNextPage();
					}}
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
