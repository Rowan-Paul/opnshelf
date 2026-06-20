import {
	type FollowedActivityItemDto,
	socialControllerGetFeedInfiniteOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { MessageCircle, UserRoundPlus } from "lucide-react-native";
import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityRow } from "@/components/social/ActivityRow";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
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
	const listStyle = useTwStyle("gap-3 px-4 pb-8");

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
			query: { pageSize: PAGE_SIZE },
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
			<View className="flex-row items-start justify-between px-4 pt-3 pb-3">
				<View className="min-w-0 flex-1">
					<Text className="font-bold font-display text-2xl text-foreground">
						Activity
					</Text>
					<Text className="text-muted-foreground text-sm">
						Recent watches and reviews from people you follow
					</Text>
				</View>
				<Link href="/friends" asChild>
					<Pressable
						hitSlop={8}
						className="ml-3 flex-row items-center gap-1.5 rounded-full border border-border px-3 py-2"
					>
						<UserRoundPlus color="#94a3b8" size={16} />
						<Text className="font-medium text-foreground text-sm">Find</Text>
					</Pressable>
				</Link>
			</View>

			{isLoading ? (
				<LoadingState label="Loading activity…" />
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
					renderItem={({ item }) => (
						<ActivityRow
							activity={item}
							containerClassName="flex-row items-start gap-3 rounded-xl border border-border bg-card p-4"
						/>
					)}
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
