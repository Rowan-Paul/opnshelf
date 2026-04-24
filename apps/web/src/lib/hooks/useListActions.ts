import {
	listsControllerAddItemToListMutation,
	listsControllerGetListsForItemQueryKey,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";

interface UseListActionsOptions {
	mediaType: "movie" | "show";
	mediaId: string;
}

export function useListActions({ mediaType, mediaId }: UseListActionsOptions) {
	const { isAuthenticated } = useAuth();
	const queryClient = useQueryClient();
	const [activeListAction, setActiveListAction] = useState<string | null>(null);

	const listsForItemKey = listsControllerGetListsForItemQueryKey({
		path: { mediaType, mediaId },
	});
	const userListsKey = listsControllerGetUserListsQueryKey();

	const addToListMutation = useMutation({
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
		onError: (_err, _variables, context) => {
			if (context?.previousListsForItem) {
				queryClient.setQueryData(
					context.listsForItemKey,
					context.previousListsForItem,
				);
			}
		},
		onSettled: (_data, _error, _variables, context) => {
			if (context?.listsForItemKey) {
				queryClient.invalidateQueries({ queryKey: context.listsForItemKey });
			}
			queryClient.invalidateQueries({ queryKey: userListsKey });
		},
	});

	const removeFromListMutation = useMutation({
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
		onError: (_err, _variables, context) => {
			if (context?.previousListsForItem) {
				queryClient.setQueryData(
					context.listsForItemKey,
					context.previousListsForItem,
				);
			}
		},
		onSettled: (_data, _error, _variables, context) => {
			if (context?.listsForItemKey) {
				queryClient.invalidateQueries({ queryKey: context.listsForItemKey });
			}
			queryClient.invalidateQueries({ queryKey: userListsKey });
		},
	});

	const toggleWatchlist = (isInWatchlist: boolean) => {
		if (!isAuthenticated) return;
		setActiveListAction("watchlist");
		const onDone = () => setActiveListAction(null);
		if (isInWatchlist) {
			removeFromListMutation.mutate(
				{
					path: { slug: "watchlist", mediaType, mediaId },
				},
				{ onSettled: onDone },
			);
		} else {
			addToListMutation.mutate(
				{
					path: { slug: "watchlist" },
					body: { mediaType, mediaId },
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
					path: { slug: "favorites", mediaType, mediaId },
				},
				{ onSettled: onDone },
			);
		} else {
			addToListMutation.mutate(
				{
					path: { slug: "favorites" },
					body: { mediaType, mediaId },
				},
				{ onSettled: onDone },
			);
		}
	};

	const addToList = (slug: string) => {
		if (!isAuthenticated) return;
		addToListMutation.mutate({
			path: { slug },
			body: { mediaType, mediaId },
		});
	};

	const removeFromList = (slug: string) => {
		if (!isAuthenticated) return;
		removeFromListMutation.mutate({
			path: { slug, mediaType, mediaId },
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
