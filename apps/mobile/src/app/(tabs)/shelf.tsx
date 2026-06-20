import {
	type ShelfResponseDto,
	shelfControllerGetUserShelfOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Library } from "lucide-react-native";
import { useMemo } from "react";
import { RefreshControl, View } from "react-native";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useTwStyle } from "@/lib/use-tw-style";

type ShelfItem = ShelfResponseDto["items"][number];

function toMediaCardItem(item: ShelfItem): MediaCardItem {
	if (item.type === "movie") {
		return {
			id: Number(item.movieId),
			type: "movie",
			title: item.title,
			posterPath: item.posterPath,
			year: item.releaseYear ? String(item.releaseYear) : undefined,
		};
	}
	// Episodes link back to their parent show.
	return {
		id: Number(item.showId),
		type: "show",
		title: item.showTitle,
		posterPath: item.posterPath,
		year: item.firstAirYear ? String(item.firstAirYear) : undefined,
	};
}

export default function ShelfScreen() {
	const { user } = useAuth();
	const userDid = user?.did ?? "";
	// FlashList isn't an RN-core component, so its className is a no-op — resolve
	// the padding to a style instead.
	const gridListStyle = useTwStyle("px-3 pb-8");

	const { data, isLoading, isError, isRefetching, refetch } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { pageSize: 50 },
		}),
		enabled: !!userDid,
	});

	const items = useMemo(
		() => (data?.items ?? []).map(toMediaCardItem),
		[data?.items],
	);

	function renderBody() {
		if (isLoading) return <LoadingState label="Loading your shelf…" />;
		if (isError) {
			return <ErrorState message="Couldn't load your shelf. Try again." />;
		}
		if (items.length === 0) {
			return (
				<EmptyState
					icon={Library}
					title="Your shelf is empty"
					message="Mark movies and episodes as watched to see them here."
				/>
			);
		}
		return (
			<FlashList
				data={items}
				numColumns={3}
				keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
				renderItem={({ item }) => (
					<View className="flex-1 px-1 pb-3">
						<MediaCard item={item} />
					</View>
				)}
				contentContainerStyle={gridListStyle}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={isRefetching}
						onRefresh={() => {
							void refetch();
						}}
						tintColor="#f3bc00"
						colors={["#f3bc00"]}
					/>
				}
			/>
		);
	}

	return (
		<Screen className="px-0">
			<View className="px-4 pb-3">
				<Text className="font-bold font-display text-2xl">Shelf</Text>
				{data?.total ? (
					<Text className="mt-0.5 text-muted-foreground text-sm">
						{data.total} item{data.total === 1 ? "" : "s"}
					</Text>
				) : null}
			</View>
			<View className="flex-1">{renderBody()}</View>
		</Screen>
	);
}
