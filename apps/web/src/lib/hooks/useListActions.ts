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
	seasonNumber?: number;
	episodeNumber?: number;
}

function buildScopedShowMediaId(
	mediaId: string,
	seasonNumber?: number,
	episodeNumber?: number,
): string {
	if (typeof seasonNumber === "number" && Number.isFinite(seasonNumber)) {
		if (typeof episodeNumber === "number" && Number.isFinite(episodeNumber)) {
			return `${mediaId}:season:${seasonNumber}:episode:${episodeNumber}`;
		}
		return `${mediaId}:season:${seasonNumber}`;
	}
	return mediaId;
}

export function useListActions({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseListActionsOptions) {
	const scopedMediaId = buildScopedShowMediaId(
		mediaId,
		seasonNumber,
		episodeNumber,
	);
	const { isAuthenticated } = useAuth();
	const queryClient = useQueryClient();
	const [activeListAction, setActiveListAction] = useState<string | null>(null);

	const listsForItemKey = listsControllerGetListsForItemQueryKey({
		path: { mediaType, mediaId: scopedMediaId },
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
					path: { slug: "watchlist", mediaType, mediaId: scopedMediaId },
				},
				{ onSettled: onDone },
			);
		} else {
			addToListMutation.mutate(
				{
					path: { slug: "watchlist" },
					body: { mediaType, mediaId: scopedMediaId },
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
					path: { slug: "favorites", mediaType, mediaId: scopedMediaId },
				},
				{ onSettled: onDone },
			);
		} else {
			addToListMutation.mutate(
				{
					path: { slug: "favorites" },
					body: { mediaType, mediaId: scopedMediaId },
				},
				{ onSettled: onDone },
			);
		}
	};

	const addToList = (slug: string) => {
		if (!isAuthenticated) return;
		addToListMutation.mutate({
			path: { slug },
			body: { mediaType, mediaId: scopedMediaId },
		});
	};

	const removeFromList = (slug: string) => {
		if (!isAuthenticated) return;
		removeFromListMutation.mutate({
			path: { slug, mediaType, mediaId: scopedMediaId },
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
