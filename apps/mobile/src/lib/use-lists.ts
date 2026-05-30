import {
	type ListsForItemDto,
	listsControllerAddItemToListMutation,
	listsControllerCreateListMutation,
	listsControllerDeleteListMutation,
	listsControllerGetListInfiniteOptions,
	listsControllerGetListQueryKey,
	listsControllerGetListsForItemOptions,
	listsControllerGetListsForItemQueryKey,
	listsControllerGetUserListsOptions,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	listsControllerUpdateListMutation,
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

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

/** All of the current user's lists. */
export function useUserLists() {
	const { isAuthenticated } = useAuth();
	return useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: isAuthenticated,
	});
}

/** A single list with its items (infinite). */
export function useList(slug: string, pageSize = 30) {
	const query = useInfiniteQuery({
		...listsControllerGetListInfiniteOptions({
			path: { slug },
			query: { pageSize },
		}),
		enabled: !!slug,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	const first = query.data?.pages[0];
	return {
		list: first,
		items: query.data?.pages.flatMap((p) => p.items) ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		fetchNextPage: query.fetchNextPage,
		hasNextPage: query.hasNextPage,
		isFetchingNextPage: query.isFetchingNextPage,
	};
}

/** Create a list. */
export function useCreateList() {
	const queryClient = useQueryClient();
	const toast = useToast();
	return useMutation({
		mutationKey: ["lists", "create"],
		...listsControllerCreateListMutation(),
		onSuccess: () => {
			toast.success("List created");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to create list")),
	});
}

/** Update a list's name/description. */
export function useUpdateList() {
	const queryClient = useQueryClient();
	const toast = useToast();
	return useMutation({
		mutationKey: ["lists", "update"],
		...listsControllerUpdateListMutation(),
		onSuccess: (_data, variables) => {
			toast.success("List updated");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({
					path: { slug: variables.path.slug },
				}),
			});
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to update list")),
	});
}

/** Delete a list. */
export function useDeleteList() {
	const queryClient = useQueryClient();
	const toast = useToast();
	return useMutation({
		mutationKey: ["lists", "delete"],
		...listsControllerDeleteListMutation(),
		onSuccess: () => {
			toast.success("List deleted");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to delete list")),
	});
}

/** Remove an item from a specific list (used on the list detail screen). */
export function useRemoveListItem(slug: string) {
	const queryClient = useQueryClient();
	const toast = useToast();
	return useMutation({
		mutationKey: ["lists", slug, "removeItem"],
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: () => {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => {},
			);
			toast.success("Removed from list");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to remove from list")),
	});
}

interface ListMembershipTarget {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

/**
 * Which of the user's lists contain a media item, plus an optimistic toggle to
 * add/remove it. Mirrors the web `useListActions` — patches `isInList` in the
 * for-item cache immediately, rolls back on error, and reconciles the for-item
 * + user-lists queries on settle.
 */
export function useListMembership(target: ListMembershipTarget) {
	const { isAuthenticated } = useAuth();
	const queryClient = useQueryClient();
	const toast = useToast();

	const resolvedMediaType =
		target.episodeNumber != null
			? "episode"
			: target.seasonNumber != null
				? "season"
				: target.mediaType;

	const listsForItemKey = listsControllerGetListsForItemQueryKey({
		path: { mediaType: resolvedMediaType, mediaId: target.mediaId },
		query: {
			seasonNumber: target.seasonNumber,
			episodeNumber: target.episodeNumber,
		},
	});
	const userListsKey = listsControllerGetUserListsQueryKey();

	const membershipQuery = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: resolvedMediaType, mediaId: target.mediaId },
			query: {
				seasonNumber: target.seasonNumber,
				episodeNumber: target.episodeNumber,
			},
		}),
		enabled: isAuthenticated && !!target.mediaId,
	});

	const patchMembership = (slug: string, isInList: boolean) => {
		queryClient.setQueryData<ListsForItemDto[]>(listsForItemKey, (old) =>
			Array.isArray(old)
				? old.map((l) => (l.listSlug === slug ? { ...l, isInList } : l))
				: old,
		);
	};

	const settle = () => {
		queryClient.invalidateQueries({ queryKey: listsForItemKey });
		queryClient.invalidateQueries({ queryKey: userListsKey });
	};

	const addMutation = useMutation({
		mutationKey: ["lists", "addItem", resolvedMediaType, target.mediaId],
		...listsControllerAddItemToListMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: listsForItemKey });
			const prev = queryClient.getQueryData<ListsForItemDto[]>(listsForItemKey);
			patchMembership(variables.path.slug, true);
			return { prev };
		},
		onError: (error, _vars, context) => {
			if (context?.prev !== undefined) {
				queryClient.setQueryData(listsForItemKey, context.prev);
			}
			toast.error(errorMessage(error, "Failed to add to list"));
		},
		onSettled: settle,
	});

	const removeMutation = useMutation({
		mutationKey: ["lists", "removeItem", resolvedMediaType, target.mediaId],
		...listsControllerRemoveItemFromListMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: listsForItemKey });
			const prev = queryClient.getQueryData<ListsForItemDto[]>(listsForItemKey);
			patchMembership(variables.path.slug, false);
			return { prev };
		},
		onError: (error, _vars, context) => {
			if (context?.prev !== undefined) {
				queryClient.setQueryData(listsForItemKey, context.prev);
			}
			toast.error(errorMessage(error, "Failed to remove from list"));
		},
		onSettled: settle,
	});

	const toggle = (slug: string, isInList: boolean) => {
		if (!isAuthenticated) return;
		void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		if (isInList) {
			removeMutation.mutate({
				path: { slug, mediaType: resolvedMediaType, mediaId: target.mediaId },
				query: {
					seasonNumber: target.seasonNumber,
					episodeNumber: target.episodeNumber,
				},
			});
		} else {
			addMutation.mutate({
				path: { slug },
				body: {
					mediaType: resolvedMediaType,
					mediaId: target.mediaId,
					seasonNumber: target.seasonNumber,
					episodeNumber: target.episodeNumber,
				},
			});
		}
	};

	return {
		memberships: membershipQuery.data ?? [],
		isLoading: membershipQuery.isLoading,
		toggle,
		isPending: addMutation.isPending || removeMutation.isPending,
	};
}
