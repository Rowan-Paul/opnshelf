import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

type LoadMoreState = {
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	isFetchNextPageError: boolean;
};

/**
 * Whether an end-reached signal should fetch the next page. A failed next
 * page stops the automatic chain: otherwise the footer skeleton disappearing
 * would re-arm the scroll container and the request would loop on a
 * persistent error. `LoadMoreFooter`'s Retry restarts the chain by hand.
 */
export function canLoadMore(query: LoadMoreState): boolean {
	return (
		query.hasNextPage &&
		!query.isFetchingNextPage &&
		!query.isFetchNextPageError
	);
}

/**
 * Tail of a scroll-loaded list: the row-shaped `skeleton` while the next page
 * is in flight, an inline Retry after a failed next page, nothing otherwise.
 * Already-loaded items stay on screen above it in both states.
 */
export function LoadMoreFooter({
	isFetchingNextPage,
	isFetchNextPageError,
	onRetry,
	skeleton,
}: {
	isFetchingNextPage: boolean;
	isFetchNextPageError: boolean;
	onRetry: () => void;
	skeleton: ReactNode;
}) {
	if (isFetchingNextPage) return <>{skeleton}</>;
	if (!isFetchNextPageError) return null;
	return (
		<View className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
			<Text className="text-muted-foreground text-sm">Couldn't load more.</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Retry loading more"
				hitSlop={8}
				onPress={onRetry}
			>
				<Text className="font-medium text-primary text-sm">Retry</Text>
			</Pressable>
		</View>
	);
}
