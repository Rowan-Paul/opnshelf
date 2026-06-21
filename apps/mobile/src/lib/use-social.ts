import {
	socialControllerFollowMutation,
	socialControllerGetFollowersInfiniteOptions,
	socialControllerGetFollowingInfiniteOptions,
	socialControllerGetSuggestionsOptions,
	socialControllerGetWatchersOptions,
	socialControllerUnfollowMutation,
} from "@opnshelf/api";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

const SOCIAL_QUERY_IDS = [
	"socialControllerGetFollowing",
	"socialControllerGetFollowers",
	"socialControllerSearchPeople",
	"socialControllerGetWatchers",
	"socialControllerGetRelationship",
	"socialControllerGetSuggestions",
];

/** Infinite list of users `handle` follows. */
export function useFollowing(handle: string, pageSize = 20) {
	const query = useInfiniteQuery({
		...socialControllerGetFollowingInfiniteOptions({
			path: { handle },
			query: { pageSize },
		}),
		enabled: !!handle,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	return {
		items: query.data?.pages.flatMap((p) => p.items) ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		fetchNextPage: query.fetchNextPage,
		hasNextPage: query.hasNextPage,
		isFetchingNextPage: query.isFetchingNextPage,
	};
}

/** Infinite list of `handle`'s followers. */
export function useFollowers(handle: string, pageSize = 20) {
	const query = useInfiniteQuery({
		...socialControllerGetFollowersInfiniteOptions({
			path: { handle },
			query: { pageSize },
		}),
		enabled: !!handle,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	return {
		items: query.data?.pages.flatMap((p) => p.items) ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		fetchNextPage: query.fetchNextPage,
		hasNextPage: query.hasNextPage,
		isFetchingNextPage: query.isFetchingNextPage,
	};
}

/** People-to-follow suggestions (used by the onboarding suggestions step). */
export function useSuggestions() {
	const { isAuthenticated } = useAuth();
	return useQuery({
		...socialControllerGetSuggestionsOptions(),
		enabled: isAuthenticated,
	});
}

/** Followed users who have watched a given media item (for the watchers row). */
export function useWatchers(
	mediaType: "movie" | "show",
	mediaId: string,
	// Backend caps watchers at 10 (`MAX_WATCHERS_PAGE_SIZE`); requesting more
	// 400s the whole query, so keep the default at the allowed maximum.
	pageSize = 10,
) {
	const { isAuthenticated } = useAuth();
	return useQuery({
		...socialControllerGetWatchersOptions({
			query: { mediaType, mediaId, pageSize },
		}),
		enabled: isAuthenticated && !!mediaId,
	});
}

/**
 * Follow / unfollow toggle. The button owns optimistic UI; this hook fires the
 * mutation and, on settle, invalidates every social surface (following,
 * followers, search, watchers, relationship) so counts and follow state across
 * screens reconcile.
 */
export function useFollowToggle() {
	const { isAuthenticated } = useAuth();
	const queryClient = useQueryClient();
	const toast = useToast();

	const invalidateSocial = () => {
		queryClient.invalidateQueries({
			predicate: (q) => {
				const key = q.queryKey[0] as { _id?: string } | undefined;
				return !!key?._id && SOCIAL_QUERY_IDS.includes(key._id);
			},
		});
	};

	const followMutation = useMutation({
		mutationKey: ["social", "follow"],
		...socialControllerFollowMutation(),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Failed to follow"),
		onSettled: invalidateSocial,
	});

	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow"],
		...socialControllerUnfollowMutation(),
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to unfollow",
			),
		onSettled: invalidateSocial,
	});

	/** Toggle follow state for a user. `currentlyFollowing` is the pre-tap state. */
	const toggle = (targetDid: string, currentlyFollowing: boolean) => {
		if (!isAuthenticated) return;
		void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		if (currentlyFollowing) {
			unfollowMutation.mutate({ path: { targetDid } });
		} else {
			followMutation.mutate({ path: { targetDid } });
		}
	};

	return { toggle, isAuthenticated };
}
