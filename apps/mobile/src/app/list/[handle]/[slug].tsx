import { getHttpStatus } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
import { List as ListIcon } from "lucide-react-native";
import { RefreshControl, View } from "react-native";
import { ListInfoCard } from "@/components/lists/ListInfoCard";
import { MediaCard } from "@/components/media/MediaCard";
import { PosterGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAuth } from "@/lib/auth-context";
import { listItemToMediaCardItem } from "@/lib/list-media";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { useProfileList, usePublicProfile } from "@/lib/use-public-profile";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { ShowProgressScope } from "@/lib/use-show-progress";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Read-only public list screen, reachable for ANY user (own or someone else's).
 * Sits at the top level (`/list/[handle]/[slug]`) to avoid clashing with the
 * owner-only `/lists/[slug]` editor and the `/profile/[handle]` file route.
 *
 * The `[handle]` segment may be a real AT Protocol handle or a raw DID — the
 * profile Lists tab links here with the owner's handle, but older deep links
 * carry a DID. When it's already a DID we use it directly; otherwise we resolve
 * it to a DID via the public profile query (`usePublicProfile` is keyed by
 * handle), mirroring how the profile screen itself resolves a handle.
 */
export default function PublicListScreen() {
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

	const {
		data: list,
		isLoading,
		isError,
		error,
	} = useProfileList(userDid, slug ?? "", !!userDid && !!slug);
	// A renamed list regenerates its slug, so a shared link can outlive the
	// list it points at. That reads as missing, not as a broken app.
	const isNotFound = getHttpStatus(error) === 404;

	const items = list?.items ?? [];
	const resolvingHandle = !isDid && profileQuery.isLoading;
	const handleError = !isDid && profileQuery.isError;

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: list?.name ?? "List" }}
			/>

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
			) : handleError || isError || !list ? (
				<ErrorState message="Couldn't load this list." />
			) : (
				<ShowProgressScope
					showIds={items
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
						data={items}
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
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								tintColor="#f3bc00"
								colors={["#f3bc00"]}
							/>
						}
						ListHeaderComponent={
							<View className="gap-3 px-1 pb-4">
								<ListInfoCard
									{...list}
									creator={creator}
									showProgress={isAuthenticated && list.total > 0}
								/>
							</View>
						}
						ListEmptyComponent={<EmptyState title="Empty list" />}
					/>
				</ShowProgressScope>
			)}
		</View>
	);
}
