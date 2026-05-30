import {
	shelfControllerGetUserActivitySummaryQueryKey,
	shelfControllerGetUserShelfQueryKey,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserUpNextInfiniteOptions,
	showsControllerGetUserUpNextQueryKey,
	showsControllerMarkWatchedMutation,
} from "@opnshelf/api";
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

/**
 * The current user's "Up Next" queue — tracked shows with their next unwatched
 * episode — as an infinite list. Mirrors the web up-next route over the shared
 * `showsControllerGetUserUpNext` procedure.
 */
export function useUpNext(pageSize = 20) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";

	const query = useInfiniteQuery({
		...showsControllerGetUserUpNextInfiniteOptions({
			path: { userDid },
			query: { pageSize },
		}),
		enabled: isAuthenticated && !!userDid,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});

	const items = query.data?.pages.flatMap((page) => page.items) ?? [];

	return {
		items,
		isLoading: query.isLoading,
		isError: query.isError,
		fetchNextPage: query.fetchNextPage,
		hasNextPage: query.hasNextPage,
		isFetchingNextPage: query.isFetchingNextPage,
		refetch: query.refetch,
	};
}

/**
 * Mark an episode watched from the Up Next queue. Invalidates the up-next list
 * (the "current" episode advances), the show's watch history, and the shelf —
 * mirroring the web `useMarkEpisodeWatched`.
 */
export function useMarkUpNextEpisode() {
	const { user } = useAuth();
	const userDid = user?.did ?? "";
	const queryClient = useQueryClient();
	const toast = useToast();

	return useMutation({
		mutationKey: ["shows", "upNext", "markEpisodeWatched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: (_data, variables) => {
			void Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			toast.success("Episode marked as watched");
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid, showId: variables.body.showId },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserUpNextQueryKey({ path: { userDid } }),
			});
			queryClient.invalidateQueries({
				queryKey: shelfControllerGetUserShelfQueryKey({ path: { userDid } }),
			});
			queryClient.invalidateQueries({
				queryKey: shelfControllerGetUserActivitySummaryQueryKey({
					path: { userDid },
				}),
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to mark episode as watched",
			);
		},
	});
}
