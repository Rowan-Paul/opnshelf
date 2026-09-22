import {
	getHttpStatus,
	type ListItemRef,
	type ListMembershipDto,
	listsControllerAddItemToListMutation,
	listsControllerCreateListMutation,
	listsControllerDeleteListMutation,
	listsControllerGetListInfiniteOptions,
	listsControllerGetListMembershipsOptions,
	listsControllerGetListMembershipsQueryKey,
	listsControllerGetListQueryKey,
	listsControllerGetPublicUserListQueryKey,
	listsControllerGetPublicUserListsQueryKey,
	listsControllerGetUserListsOptions,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	listsControllerReorderListItemsMutation,
	listsControllerUpdateListMutation,
	listsForItem,
	retryUnlessNotFound,
	withMembership,
} from "@opnshelf/api";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { posthog } from "@/lib/posthog";

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

function captureListChange(
	slug: string,
	action: "added" | "removed",
	mediaType: string,
) {
	if (slug === "watchlist") {
		posthog?.capture("watchlist_changed", { action, media_type: mediaType });
		return;
	}
	if (slug === "favorites") {
		posthog?.capture("favorite_changed", { action, media_type: mediaType });
		return;
	}
	posthog?.capture("list_item_changed", {
		action,
		media_type: mediaType,
		list_kind: "custom",
	});
}

/** Refresh the public profile list views for the current owner only. */
export function invalidatePublicListQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	userDid: string | undefined,
	slug?: string,
) {
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
}

/** All of the current user's lists. */
export function useUserLists() {
	const { isAuthenticated } = useAuth();
	return useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: isAuthenticated,
	});
}

/** Item sort orders supported by the list read endpoint. */
export type ListSort = "position" | "added" | "title" | "year";

/**
 * A single list with its items (infinite). `sort` is folded into the query key
 * so switching order refetches from page 1 rather than reusing stale pages.
 */
export function useList(
	slug: string,
	sort: ListSort = "position",
	pageSize = 30,
) {
	const query = useInfiniteQuery({
		...listsControllerGetListInfiniteOptions({
			path: { slug },
			query: { pageSize, sort },
		}),
		enabled: !!slug,
		initialPageParam: 1,
		// A renamed list leaves its old slug dead, so a stale link lands here.
		// The endpoint answers 404 for that, which surfaces as `isError` and
		// leaves no page behind to dereference.
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
		retry: retryUnlessNotFound,
	});
	const first = query.data?.pages[0];
	return {
		list: first,
		items: query.data?.pages.flatMap((p) => p.items) ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		// A dead slug is worth saying out loud: "this list is gone" is a
		// different instruction to the reader than "try again".
		isNotFound: getHttpStatus(query.error) === 404,
		fetchNextPage: query.fetchNextPage,
		hasNextPage: query.hasNextPage,
		isFetchingNextPage: query.isFetchingNextPage,
		refetch: query.refetch,
		isFetching: query.isFetching,
	};
}

/** Create a list. */
export function useCreateList() {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { user } = useAuth();
	return useMutation({
		mutationKey: ["lists", "create"],
		...listsControllerCreateListMutation(),
		onSuccess: (_data, variables) => {
			posthog?.capture("list_created", {
				has_description: Boolean(variables.body.description?.trim()),
			});
			toast.success("List created");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			invalidatePublicListQueries(queryClient, user?.did);
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to create list")),
	});
}

/** Update a list's name/description. */
export function useUpdateList() {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { user } = useAuth();
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
			invalidatePublicListQueries(queryClient, user?.did, variables.path.slug);
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to update list")),
	});
}

/** Delete a list. */
export function useDeleteList() {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { user } = useAuth();
	return useMutation({
		mutationKey: ["lists", "delete"],
		...listsControllerDeleteListMutation(),
		onSuccess: (_data, variables) => {
			toast.success("List deleted");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			invalidatePublicListQueries(queryClient, user?.did, variables.path.slug);
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to delete list")),
	});
}

/** Remove an item from a specific list (used on the list detail screen). */
export function useRemoveListItem(slug: string) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { user } = useAuth();
	return useMutation({
		mutationKey: ["lists", slug, "removeItem"],
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: (_data, variables) => {
			captureListChange(slug, "removed", variables.path.mediaType);
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
			invalidatePublicListQueries(queryClient, user?.did, slug);
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to remove from list")),
	});
}

/** Add an item to a specific list (used by the add-items sheet on the detail screen). */
export function useAddListItem(slug: string) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { user } = useAuth();
	return useMutation({
		mutationKey: ["lists", slug, "addItem"],
		...listsControllerAddItemToListMutation(),
		onSuccess: (_data, variables) => {
			captureListChange(slug, "added", variables.body.mediaType);
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => {},
			);
			toast.success("Added to list");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			invalidatePublicListQueries(queryClient, user?.did, slug);
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to add to list")),
	});
}

/** Reorder a list's items (owner only). Body is the full ordered list of item ids. */
export function useReorderListItems(slug: string) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { user } = useAuth();
	return useMutation({
		mutationKey: ["lists", slug, "reorder"],
		...listsControllerReorderListItemsMutation(),
		onSuccess: () => {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
				() => {},
			);
			toast.success("Order saved");
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
			invalidatePublicListQueries(queryClient, user?.did, slug);
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to save order")),
	});
}

interface ListMembershipTarget {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	/** Defaults to true. See the note on NoteTarget.enabled: a poster grid mounts
	 *  one of these per card and trips the API's rate limit. */
	enabled?: boolean;
}

/**
 * Which of the user's lists contain a media item, plus an optimistic toggle to
 * add/remove it. Mirrors the web `useListItemStatus` + `useListActions`: the
 * state comes from one shared memberships read for every card on screen, not a
 * request per item (ADR 0040), and a toggle patches that shared entry, rolls
 * back on error, and reconciles on settle.
 */
export function useListMembership(target: ListMembershipTarget) {
	const { isAuthenticated, user } = useAuth();
	const queryClient = useQueryClient();
	const toast = useToast();

	const resolvedMediaType: ListItemRef["mediaType"] =
		target.episodeNumber != null
			? "episode"
			: target.seasonNumber != null
				? "season"
				: target.mediaType;
	const item = useMemo<ListItemRef>(
		() => ({
			mediaType: resolvedMediaType,
			mediaId: target.mediaId,
			seasonNumber: target.seasonNumber,
			episodeNumber: target.episodeNumber,
		}),
		[
			resolvedMediaType,
			target.mediaId,
			target.seasonNumber,
			target.episodeNumber,
		],
	);

	const membershipsKey = listsControllerGetListMembershipsQueryKey();
	const userListsKey = listsControllerGetUserListsQueryKey();
	const enabled =
		isAuthenticated && !!target.mediaId && target.enabled !== false;

	const membershipsQuery = useQuery({
		...listsControllerGetListMembershipsOptions(),
		enabled,
	});
	const userListsQuery = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled,
	});

	const memberships = useMemo(
		() =>
			membershipsQuery.data && userListsQuery.data
				? listsForItem(membershipsQuery.data, userListsQuery.data, item)
				: [],
		[membershipsQuery.data, userListsQuery.data, item],
	);

	const listName = (slug: string) =>
		memberships.find((l) => l.listSlug === slug)?.listName ?? "list";

	const patchMembership = async (slug: string, isInList: boolean) => {
		await queryClient.cancelQueries({ queryKey: membershipsKey });
		const prev = queryClient.getQueryData<ListMembershipDto[]>(membershipsKey);
		const listId = userListsQuery.data?.find((l) => l.slug === slug)?.id;
		if (prev && listId) {
			queryClient.setQueryData(
				membershipsKey,
				withMembership(prev, item, listId, isInList),
			);
		}
		return { prev };
	};

	const settle = (slug?: string) => {
		queryClient.invalidateQueries({ queryKey: membershipsKey });
		queryClient.invalidateQueries({ queryKey: userListsKey });
		invalidatePublicListQueries(queryClient, user?.did, slug);
	};

	const addMutation = useMutation({
		mutationKey: ["lists", "addItem", resolvedMediaType, target.mediaId],
		...listsControllerAddItemToListMutation(),
		onMutate: (variables) => patchMembership(variables.path.slug, true),
		onSuccess: (_data, variables) => {
			captureListChange(variables.path.slug, "added", resolvedMediaType);
			toast.success(`Added to ${listName(variables.path.slug)}`);
		},
		onError: (error, _vars, context) => {
			if (context?.prev !== undefined) {
				queryClient.setQueryData(membershipsKey, context.prev);
			}
			toast.error(errorMessage(error, "Failed to add to list"));
		},
		onSettled: (_data, _error, variables) => settle(variables?.path.slug),
	});

	const removeMutation = useMutation({
		mutationKey: ["lists", "removeItem", resolvedMediaType, target.mediaId],
		...listsControllerRemoveItemFromListMutation(),
		onMutate: (variables) => patchMembership(variables.path.slug, false),
		onSuccess: (_data, variables) => {
			captureListChange(variables.path.slug, "removed", resolvedMediaType);
			toast.success(`Removed from ${listName(variables.path.slug)}`);
		},
		onError: (error, _vars, context) => {
			if (context?.prev !== undefined) {
				queryClient.setQueryData(membershipsKey, context.prev);
			}
			toast.error(errorMessage(error, "Failed to remove from list"));
		},
		onSettled: (_data, _error, variables) => settle(variables?.path.slug),
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
		memberships,
		isLoading: membershipsQuery.isLoading || userListsQuery.isLoading,
		toggle,
		isPending: addMutation.isPending || removeMutation.isPending,
	};
}
