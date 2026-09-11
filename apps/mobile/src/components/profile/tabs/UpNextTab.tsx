import { Tv } from "lucide-react-native";
import { View } from "react-native";
import { canLoadMore, LoadMoreFooter } from "@/components/ui/load-more";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { UpNextCard } from "@/components/up-next/UpNextCard";
import { UpNextSkeleton } from "@/components/up-next/UpNextSkeleton";
import { useEndReached } from "@/lib/use-end-reached";
import { useInfiniteProfileUpNext } from "@/lib/use-public-profile";

/**
 * Up Next tab: in-progress shows with their next episode + watch progress,
 * loaded page by page as the reader scrolls. Owners get an "Add to shelf"
 * button that marks the next episode watched. Mirrors the web up-next page.
 */
export function UpNextTab({
	userDid,
	isOwner,
	showHeading = true,
}: {
	userDid: string;
	isOwner: boolean;
	/**
	 * Off for the full-screen drill-down route, where the native stack header
	 * already shows "Up Next" (avoids a duplicate title); on inside the tabbed
	 * profile hub where the section needs its own label.
	 */
	showHeading?: boolean;
}) {
	const {
		data,
		isLoading,
		isError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
	} = useInfiniteProfileUpNext(userDid);

	const items = data?.pages.flatMap((page) => page.items) ?? [];
	const loadMore = { hasNextPage, isFetchingNextPage, isFetchNextPageError };
	useEndReached(() => {
		if (canLoadMore(loadMore)) void fetchNextPage();
	});

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			{showHeading ? (
				<Text className="font-bold font-display text-2xl text-foreground">
					Up Next
				</Text>
			) : null}

			{isLoading ? (
				<UpNextSkeleton rows={4} />
			) : isError && items.length === 0 ? (
				<ErrorState message="Couldn't load Up Next." />
			) : items.length === 0 ? (
				<EmptyState
					icon={Tv}
					title="All caught up!"
					message="No upcoming episodes to watch."
				/>
			) : (
				<View className="gap-3">
					{items.map((item) => (
						<UpNextCard
							key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
							item={item}
							isOwner={isOwner}
						/>
					))}
				</View>
			)}

			<LoadMoreFooter
				{...loadMore}
				onRetry={() => void fetchNextPage()}
				skeleton={<UpNextSkeleton rows={1} />}
			/>
		</View>
	);
}
