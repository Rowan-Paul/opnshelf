import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { MediaCard } from "@/components/media/MediaCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { listItemToMediaCardItem } from "@/lib/list-media";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { useProfileList, usePublicProfile } from "@/lib/use-public-profile";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Read-only public list screen, reachable for ANY user (own or someone else's).
 * Sits at the top level (`/list/[handle]/[slug]`) to avoid clashing with the
 * owner-only `/lists/[slug]` editor and the `/profile/[handle]` file route.
 *
 * The `[handle]` segment may be a real AT Protocol handle or a raw DID — the
 * profile Lists tab links here with the resolved `userDid`. When it's already a
 * DID we use it directly; otherwise we resolve it to a DID via the public
 * profile query (`usePublicProfile` is keyed by handle), mirroring how the
 * profile screen itself resolves a handle.
 */
export default function PublicListScreen() {
	const { handle: handleParam, slug } = useLocalSearchParams<{
		handle: string;
		slug: string;
	}>();
	const gridStyle = useTwStyle("px-3 pb-12");

	const segment = handleParam ? decodeURIComponent(handleParam) : "";
	const isDid = segment.startsWith("did:");
	const numColumns = useMediaCardColumns();

	// Only hit the profile endpoint when the segment is a handle, not a DID.
	const profileQuery = usePublicProfile(isDid ? "" : segment);
	const userDid = isDid ? segment : (profileQuery.data?.did ?? "");

	const {
		data: list,
		isLoading,
		isError,
	} = useProfileList(userDid, slug ?? "", !!userDid && !!slug);

	const items = list?.items ?? [];
	const resolvingHandle = !isDid && profileQuery.isLoading;
	const handleError = !isDid && profileQuery.isError;

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: list?.name ?? "List" }}
			/>

			{resolvingHandle || isLoading ? (
				<LoadingState />
			) : handleError || isError || !list ? (
				<ErrorState message="Couldn't load this list." />
			) : (
				<FlashList
					key={`grid-${numColumns}`}
					data={items}
					numColumns={numColumns}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<View className="flex-1 px-1 pb-3">
							<MediaCard item={listItemToMediaCardItem(item)} actions />
						</View>
					)}
					contentContainerStyle={gridStyle}
					showsVerticalScrollIndicator={false}
					ListHeaderComponent={
						<View className="gap-3 px-1 pb-4">
							{list.description ? (
								<Text className="text-muted-foreground text-sm leading-5">
									{list.description}
								</Text>
							) : null}
							<Text className="text-muted-foreground text-xs">
								{list.total} item{list.total === 1 ? "" : "s"}
							</Text>
						</View>
					}
					ListEmptyComponent={<EmptyState title="Empty list" />}
				/>
			)}
		</View>
	);
}
