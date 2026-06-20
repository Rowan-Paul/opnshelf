import {
	listsControllerAddItemToListMutation,
	listsControllerGetListsForItemQueryKey,
	listsControllerGetPublicUserListQueryKey,
	listsControllerGetPublicUserListsQueryKey,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "#/lib/auth-context";

interface UseListActionsOptions {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useListActions({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseListActionsOptions) {
	const resolvedMediaType =
		episodeNumber != null
			? "episode"
			: seasonNumber != null
				? "season"
				: mediaType;

	const { isAuthenticated, user } = useAuth();
	const queryClient = useQueryClient();
	const [activeListAction, setActiveListAction] = useState<string | null>(null);

	const listsForItemKey = listsControllerGetListsForItemQueryKey({
		path: { mediaType: resolvedMediaType, mediaId },
		query: { seasonNumber, episodeNumber },
	});
	const userListsKey = listsControllerGetUserListsQueryKey();

	// The profile pages read from the PUBLIC list queries, which are keyed by the
	// owner's did and are separate from the authenticated `getUserLists` cache.
	// Invalidate them too so profile list views refresh after add/remove.
	const invalidatePublicLists = (slug?: string) => {
		const userDid = user?.did;
		if (!userDid) return;
		queryClient.invalidateQueries({
			queryKey: listsControllerGetPublicUserListsQueryKey({
				path: { userDid },
			}),
		});
		if (slug) {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetPublicUserListQueryKey({
					path: { userDid, slug },
				}),
			});
		}
	};

	const addToListMutation = useMutation({
		mutationKey: ["lists", "addItem", resolvedMediaType, mediaId],
		...listsControllerAddItemToListMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: listsForItemKey });
			const previousListsForItem = queryClient.getQueryData(listsForItemKey);

			queryClient.setQueryData(listsForItemKey, (old: unknown) => {
				if (!old || !Array.isArray(old)) return old;
				return old.map((list: { listSlug: string; isInList: boolean }) =>
					list.listSlug === variables.path.slug
						? { ...list, isInList: true }
						: list,
				);
			});

			return { previousListsForItem, listsForItemKey };
		},
		onSuccess: () => {
			toast.success("Added to list");
		},
		onError: (error, _variables, context) => {
			if (context?.previousListsForItem) {
				queryClient.setQueryData(
					context.listsForItemKey,
					context.previousListsForItem,
				);
			}
			toast.error(
				error instanceof Error ? error.message : "Failed to add to list",
			);
		},
		onSettled: (_data, _error, variables, context) => {
			if (context?.listsForItemKey) {
				queryClient.invalidateQueries({ queryKey: context.listsForItemKey });
			}
			queryClient.invalidateQueries({ queryKey: userListsKey });
			invalidatePublicLists(variables?.path?.slug);
		},
	});

	const removeFromListMutation = useMutation({
		mutationKey: ["lists", "removeItem", resolvedMediaType, mediaId],
		...listsControllerRemoveItemFromListMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: listsForItemKey });
			const previousListsForItem = queryClient.getQueryData(listsForItemKey);

			queryClient.setQueryData(listsForItemKey, (old: unknown) => {
				if (!old || !Array.isArray(old)) return old;
				return old.map((list: { listSlug: string; isInList: boolean }) =>
					list.listSlug === variables.path.slug
						? { ...list, isInList: false }
						: list,
				);
			});

			return { previousListsForItem, listsForItemKey };
		},
		onSuccess: () => {
			toast.success("Removed from list");
		},
		onError: (error, _variables, context) => {
			if (context?.previousListsForItem) {
				queryClient.setQueryData(
					context.listsForItemKey,
					context.previousListsForItem,
				);
			}
			toast.error(
				error instanceof Error ? error.message : "Failed to remove from list",
			);
		},
		onSettled: (_data, _error, variables, context) => {
			if (context?.listsForItemKey) {
				queryClient.invalidateQueries({ queryKey: context.listsForItemKey });
			}
			queryClient.invalidateQueries({ queryKey: userListsKey });
			invalidatePublicLists(variables?.path?.slug);
		},
	});

	const toggleWatchlist = (isInWatchlist: boolean) => {
		if (!isAuthenticated) return;
		setActiveListAction("watchlist");
		const onDone = () => setActiveListAction(null);
		if (isInWatchlist) {
			removeFromListMutation.mutate(
				{
					path: { slug: "watchlist", mediaType: resolvedMediaType, mediaId },
					query: { seasonNumber, episodeNumber },
				},
				{ onSettled: onDone },
			);
		} else {
			addToListMutation.mutate(
				{
					path: { slug: "watchlist" },
					body: {
						mediaType: resolvedMediaType,
						mediaId,
						seasonNumber,
						episodeNumber,
					},
				},
				{ onSettled: onDone },
			);
		}
	};

	const toggleFavorites = (isInFavorites: boolean) => {
		if (!isAuthenticated) return;
		setActiveListAction("favorites");
		const onDone = () => setActiveListAction(null);
		if (isInFavorites) {
			removeFromListMutation.mutate(
				{
					path: { slug: "favorites", mediaType: resolvedMediaType, mediaId },
					query: { seasonNumber, episodeNumber },
				},
				{ onSettled: onDone },
			);
		} else {
			addToListMutation.mutate(
				{
					path: { slug: "favorites" },
					body: {
						mediaType: resolvedMediaType,
						mediaId,
						seasonNumber,
						episodeNumber,
					},
				},
				{ onSettled: onDone },
			);
		}
	};

	const addToList = (slug: string) => {
		if (!isAuthenticated) return;
		addToListMutation.mutate({
			path: { slug },
			body: {
				mediaType: resolvedMediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
			},
		});
	};

	const removeFromList = (slug: string) => {
		if (!isAuthenticated) return;
		removeFromListMutation.mutate({
			path: { slug, mediaType: resolvedMediaType, mediaId },
			query: { seasonNumber, episodeNumber },
		});
	};

	const isPending =
		addToListMutation.isPending || removeFromListMutation.isPending;

	return {
		toggleWatchlist,
		toggleFavorites,
		addToList,
		removeFromList,
		activeListAction,
		isPending,
	};
}
