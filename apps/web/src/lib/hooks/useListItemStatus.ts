import {
	listsControllerGetUserListsOptions,
	listsControllerGetUserListsQueryKey,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "#/lib/auth-context";
import {
	listsForItem as deriveListsForItem,
	listMembershipsKey,
	listMembershipsQuery,
} from "./list-memberships";

interface UseListItemStatusOptions {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	enabled?: boolean;
}

export function useListItemStatus({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	enabled = true,
}: UseListItemStatusOptions) {
	const resolvedMediaType =
		episodeNumber != null
			? "episode"
			: seasonNumber != null
				? "season"
				: mediaType;

	const { isAuthenticated } = useAuth();

	// One shared request per page, not one per card; see list-memberships.
	const { data: memberships } = useQuery({
		...listMembershipsQuery(),
		enabled: isAuthenticated && enabled,
	});

	const { data: userLists } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: isAuthenticated,
	});

	const listsForItem = useMemo(
		() =>
			memberships && userLists
				? deriveListsForItem(memberships, userLists, {
						mediaType: resolvedMediaType,
						mediaId,
						seasonNumber,
						episodeNumber,
					})
				: undefined,
		[
			memberships,
			userLists,
			resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		],
	);

	const isInWatchlist = useMemo(() => {
		if (!listsForItem || !Array.isArray(listsForItem)) return false;
		return listsForItem.some(
			(list) => list.listSlug === "watchlist" && list.isInList,
		);
	}, [listsForItem]);

	const isInFavorites = useMemo(() => {
		if (!listsForItem || !Array.isArray(listsForItem)) return false;
		return listsForItem.some(
			(list) => list.listSlug === "favorites" && list.isInList,
		);
	}, [listsForItem]);

	const otherLists = useMemo(
		() => listsForItem?.filter((list) => list.isInList) || [],
		[listsForItem],
	);

	const availableLists = useMemo(() => {
		if (!userLists || !listsForItem) return [];
		const listIdsInItem = new Set(
			listsForItem.filter((l) => l.isInList).map((l) => l.listId),
		);
		return userLists.filter((list) => !listIdsInItem.has(list.id));
	}, [userLists, listsForItem]);

	const customListsWithStatus = useMemo(() => {
		if (!userLists || !listsForItem) return [];
		const inListSlugs = new Set(
			listsForItem.filter((l) => l.isInList).map((l) => l.listSlug),
		);
		return userLists
			.filter((l) => l.slug !== "watchlist" && l.slug !== "favorites")
			.map((list) => ({
				slug: list.slug,
				name: list.name,
				isInList: inListSlugs.has(list.slug),
			}));
	}, [userLists, listsForItem]);

	return {
		listsForItem,
		userLists,
		isInWatchlist,
		isInFavorites,
		otherLists,
		availableLists,
		customListsWithStatus,
		listMembershipsKey: listMembershipsKey(),
		userListsKey: listsControllerGetUserListsQueryKey(),
	};
}
