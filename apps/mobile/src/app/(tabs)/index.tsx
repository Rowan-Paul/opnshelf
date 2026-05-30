import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import { CalendarDays, Tv } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { UpNextCard } from "@/components/up-next/UpNextCard";
import { useTwStyle } from "@/lib/use-tw-style";
import { useMarkUpNextEpisode, useUpNext } from "@/lib/use-up-next";

export default function HomeScreen() {
	const listStyle = useTwStyle("px-4 pb-8");
	const {
		items,
		isLoading,
		isError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useUpNext();
	const markEpisode = useMarkUpNextEpisode();

	const handleMarkWatched = (
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	) => {
		markEpisode.mutate({ body: { showId, seasonNumber, episodeNumber } });
	};

	function renderBody() {
		if (isLoading) return <LoadingState label="Loading your queue…" />;
		if (isError) {
			return <ErrorState message="Couldn't load Up Next. Try again." />;
		}
		if (items.length === 0) {
			return (
				<EmptyState
					icon={Tv}
					title="All caught up!"
					message="No upcoming episodes to watch. Track a show to see it here."
				/>
			);
		}
		return (
			<FlashList
				data={items}
				keyExtractor={(item) =>
					`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`
				}
				renderItem={({ item }) => (
					<View className="pb-3">
						<UpNextCard
							item={item}
							onMarkWatched={handleMarkWatched}
							isMarking={markEpisode.isPending}
						/>
					</View>
				)}
				contentContainerStyle={listStyle}
				showsVerticalScrollIndicator={false}
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
		);
	}

	return (
		<Screen className="px-0">
			<View className="flex-row items-center justify-between px-4 pb-3">
				<Text className="font-bold font-display text-2xl">Up Next</Text>
				<Link href="/calendar" asChild>
					<Pressable
						hitSlop={8}
						className="flex-row items-center gap-1.5 rounded-lg border border-border px-3 py-1.5"
					>
						<CalendarDays color="#94a3b8" size={16} />
						<Text className="font-medium text-foreground text-sm">
							Calendar
						</Text>
					</Pressable>
				</Link>
			</View>
			<View className="flex-1">{renderBody()}</View>
		</Screen>
	);
}
