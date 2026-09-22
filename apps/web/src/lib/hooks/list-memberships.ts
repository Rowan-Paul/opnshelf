import {
	type ListMembershipDto,
	type ListsForItemDto,
	listsControllerGetListMembershipsOptions,
	listsControllerGetListMembershipsQueryKey,
} from "@opnshelf/api";

/** A media item as the lists store it: season and episode are 0 when absent. */
export interface ListItemRef {
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

/**
 * Every item in the viewer's lists, fetched once per page for all its posters.
 * Each card used to ask `/lists/for-item/...` for itself: 120 requests on a
 * signed-in search page, enough to trip the session rate limit.
 */
export const listMembershipsQuery = () =>
	listsControllerGetListMembershipsOptions();

export const listMembershipsKey = () =>
	listsControllerGetListMembershipsQueryKey();

function sameItem(membership: ListMembershipDto, item: ListItemRef): boolean {
	return (
		membership.mediaType === item.mediaType &&
		membership.mediaId === item.mediaId &&
		membership.seasonNumber === (item.seasonNumber ?? 0) &&
		membership.episodeNumber === (item.episodeNumber ?? 0)
	);
}

/** The per-item shape `/lists/for-item/...` returned, derived from both caches. */
export function listsForItem(
	memberships: ListMembershipDto[],
	userLists: Array<{
		id: string;
		name: string;
		slug: string;
		isDefault: boolean;
	}>,
	item: ListItemRef,
): ListsForItemDto[] {
	const listIds = new Set(
		memberships.find((membership) => sameItem(membership, item))?.listIds,
	);
	return userLists.map((list) => ({
		listId: list.id,
		listName: list.name,
		listSlug: list.slug,
		isDefault: list.isDefault,
		isInList: listIds.has(list.id),
	}));
}

/** Memberships with one item added to or removed from one list. */
export function withMembership(
	memberships: ListMembershipDto[],
	item: ListItemRef,
	listId: string,
	isInList: boolean,
): ListMembershipDto[] {
	const index = memberships.findIndex((membership) =>
		sameItem(membership, item),
	);
	if (index === -1) {
		if (!isInList) return memberships;
		return [
			...memberships,
			{
				mediaType: item.mediaType,
				mediaId: item.mediaId,
				seasonNumber: item.seasonNumber ?? 0,
				episodeNumber: item.episodeNumber ?? 0,
				listIds: [listId],
			},
		];
	}
	const current = memberships[index];
	const listIds = isInList
		? [...new Set([...current.listIds, listId])]
		: current.listIds.filter((id) => id !== listId);
	return memberships.map((membership, i) =>
		i === index ? { ...current, listIds } : membership,
	);
}
