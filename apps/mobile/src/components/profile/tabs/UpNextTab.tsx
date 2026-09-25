import { usersControllerGetMySettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Tv } from "lucide-react-native";
import { View } from "react-native";
import { canLoadMore, LoadMoreFooter } from "@/components/ui/load-more";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { UpNextCard } from "@/components/up-next/UpNextCard";
import { UpNextServiceFilter } from "@/components/up-next/UpNextServiceFilter";
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
	const { services: servicesParam } = useLocalSearchParams<{
		services?: string;
	}>();
	const router = useRouter();
	const services =
		isOwner &&
		typeof servicesParam === "string" &&
		/^(mine|[1-9][0-9]{0,8}(,[1-9][0-9]{0,8}){0,49})$/.test(servicesParam)
			? servicesParam
			: undefined;
	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: isOwner,
	});
	const country = settings?.watchCountry ?? "US";
	const {
		data,
		isLoading,
		isFetching,
		isPlaceholderData,
		isError,
		refetch,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
	} = useInfiniteProfileUpNext(userDid, services, settings);

	const items = data?.pages.flatMap((page) => page.items) ?? [];
	const loadMore = { hasNextPage, isFetchingNextPage, isFetchNextPageError };
	useEndReached(() => {
		if (!isFetching && !isPlaceholderData && canLoadMore(loadMore))
			void fetchNextPage();
	});

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			{showHeading ? (
				<Text className="font-bold font-display text-2xl text-foreground">
					Up Next
				</Text>
			) : null}

			{isOwner && (
				<UpNextServiceFilter
					country={country}
					savedIds={settings?.streamingServiceIds ?? []}
					value={services}
					onChange={(services) => router.setParams({ services })}
				/>
			)}
			{isError && items.length > 0 && (
				<ErrorState
					message="Couldn't refresh Up Next."
					onRetry={() => void refetch()}
				/>
			)}
			<View
				style={{ opacity: isFetching && !isFetchingNextPage && data ? 0.5 : 1 }}
				accessibilityState={{ busy: isFetching }}
			>
				{isLoading ? (
					<UpNextSkeleton rows={4} />
				) : isError && items.length === 0 ? (
					<ErrorState
						message="Couldn't load Up Next."
						onRetry={() => void refetch()}
					/>
				) : items.length === 0 ? (
					<EmptyState
						icon={Tv}
						title={services ? "No shows on these services" : "All caught up!"}
						message={
							services
								? "Turn off the filter to see all of Up Next."
								: "No upcoming episodes to watch."
						}
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
			</View>
			<LoadMoreFooter
				{...loadMore}
				onRetry={() => void fetchNextPage()}
				skeleton={<UpNextSkeleton rows={1} />}
			/>
		</View>
	);
}
