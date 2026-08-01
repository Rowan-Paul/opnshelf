import {
	invalidateWatchActivityQueries,
	showsControllerGetUserUpNextInfiniteOptions,
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
 * `showsControllerGetUserUpNext` procedure. Pass `showId` when you only care
 * about one show: the queue is paginated, so a show far down the list would
 * otherwise be missing from the first page.
 */
export function useUpNext(pageSize = 20, showId?: string) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";

	const query = useInfiniteQuery({
		...showsControllerGetUserUpNextInfiniteOptions({
			path: { userDid },
			query: showId ? { pageSize, showId } : { pageSize },
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
 * Mark an episode watched from the Up Next queue. Invalidates every
 * watch-activity query — the up-next list (the "current" episode advances), the
 * show's watch history, the shelf and the profile stats behind the dashboard
 * bar chart — mirroring the web `useMarkEpisodeWatched`.
 */
export function useMarkUpNextEpisode() {
	const queryClient = useQueryClient();
	const toast = useToast();

	return useMutation({
		mutationKey: ["shows", "upNext", "markEpisodeWatched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			void Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			toast.success("Episode added to shelf");
			invalidateWatchActivityQueries(queryClient);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to add episode to shelf",
			);
		},
	});
}
