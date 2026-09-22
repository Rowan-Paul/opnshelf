import {
	type ListMembershipDto,
	type ListSummaryDto,
	listsControllerAddItemToListMutation,
	listsControllerGetPublicUserListQueryKey,
	listsControllerGetPublicUserListsQueryKey,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";
import {
	type ListItemRef,
	listMembershipsKey,
	withMembership,
} from "./list-memberships";

interface UseListActionsOptions {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

function captureListChange(
	slug: string,
	action: "added" | "removed",
	mediaType: string,
) {
	if (slug === "watchlist") {
		posthog.capture("watchlist_changed", { action, media_type: mediaType });
		return;
	}
	if (slug === "favorites") {
		posthog.capture("favorite_changed", { action, media_type: mediaType });
		return;
	}
	posthog.capture("list_item_changed", {
		action,
		media_type: mediaType,
		list_kind: "custom",
	});
}

export function useListActions({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseListActionsOptions) {
	const resolvedMediaType: ListItemRef["mediaType"] =
		episodeNumber != null
			? "episode"
			: seasonNumber != null
				? "season"
				: mediaType;

	const { isAuthenticated, user } = useAuth();
	const queryClient = useQueryClient();
	const [activeListAction, setActiveListAction] = useState<string | null>(null);

	const membershipsKey = listMembershipsKey();
	const userListsKey = listsControllerGetUserListsQueryKey();
	const item = {
		mediaType: resolvedMediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	};

	// Every card reads the one memberships cache, so an add or remove shows on
	// every poster of this item at once, then settles with a refetch.
	const applyOptimistic = async (slug: string, isInList: boolean) => {
		await queryClient.cancelQueries({ queryKey: membershipsKey });
		const previous =
			queryClient.getQueryData<ListMembershipDto[]>(membershipsKey);
		const listId = queryClient
			.getQueryData<ListSummaryDto[]>(userListsKey)
			?.find((list) => list.slug === slug)?.id;
		if (previous && listId) {
			queryClient.setQueryData(
				membershipsKey,
				withMembership(previous, item, listId, isInList),
			);
		}
		return { previous };
	};
	const rollback = (context?: { previous?: ListMembershipDto[] }) => {
		if (context?.previous) {
			queryClient.setQueryData(membershipsKey, context.previous);
		}
	};

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
		onMutate: (variables) => applyOptimistic(variables.path.slug, true),
		onSuccess: (_data, variables) => {
			captureListChange(variables.path.slug, "added", resolvedMediaType);
			toast.success("Added to list");
		},
		onError: (error, _variables, context) => {
			rollback(context);
			toast.error(
				error instanceof Error ? error.message : "Failed to add to list",
			);
		},
		onSettled: (_data, _error, variables) => {
			queryClient.invalidateQueries({ queryKey: membershipsKey });
			queryClient.invalidateQueries({ queryKey: userListsKey });
			invalidatePublicLists(variables?.path?.slug);
		},
	});

	const removeFromListMutation = useMutation({
		mutationKey: ["lists", "removeItem", resolvedMediaType, mediaId],
		...listsControllerRemoveItemFromListMutation(),
		onMutate: (variables) => applyOptimistic(variables.path.slug, false),
		onSuccess: (_data, variables) => {
			captureListChange(variables.path.slug, "removed", resolvedMediaType);
			toast.success("Removed from list");
		},
		onError: (error, _variables, context) => {
			rollback(context);
			toast.error(
				error instanceof Error ? error.message : "Failed to remove from list",
			);
		},
		onSettled: (_data, _error, variables) => {
			queryClient.invalidateQueries({ queryKey: membershipsKey });
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
