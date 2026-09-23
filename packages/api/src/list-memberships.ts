import type {
	ListMembershipDto,
	ListsForItemDto,
	MovieWatchCountDto,
} from "./generated";

/**
 * Pure helpers for the once-per-viewer reads that replaced per-card requests
 * (ADR 0040): list membership from `GET /lists/items/memberships`, and watch
 * counts from `GET /movies/user/:did/watch-counts`. Shared so Web and Mobile
 * derive a card's state, and patch it optimistically, the same way.
 */

/** A media item as the lists store it: season and episode are 0 when absent. */
export interface ListItemRef {
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

/** The fields of the viewer's lists a card needs. */
export interface ListRef {
	id: string;
	name: string;
	slug: string;
	isDefault: boolean;
}

function sameItem(membership: ListMembershipDto, item: ListItemRef): boolean {
	return (
		membership.mediaType === item.mediaType &&
		membership.mediaId === item.mediaId &&
		membership.seasonNumber === (item.seasonNumber ?? 0) &&
		membership.episodeNumber === (item.episodeNumber ?? 0)
	);
}

/** The per-item shape `/lists/for-item/...` returned, derived from both reads. */
export function listsForItem(
	memberships: ListMembershipDto[],
	userLists: ListRef[],
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

/** How many Watches the viewer logged of a movie, 0 when none. */
export function movieWatchCount(
	counts: MovieWatchCountDto[] | undefined,
	movieId: string,
): number {
	return counts?.find((count) => count.movieId === movieId)?.watchCount ?? 0;
}

/** Counts with one more Watch of a movie, as marking it watched logs. */
export function withMovieWatch(
	counts: MovieWatchCountDto[],
	movieId: string,
): MovieWatchCountDto[] {
	if (!counts.some((count) => count.movieId === movieId)) {
		return [...counts, { movieId, watchCount: 1 }];
	}
	return counts.map((count) =>
		count.movieId === movieId
			? { ...count, watchCount: count.watchCount + 1 }
			: count,
	);
}

/** Counts without a movie, as removing all of its Watches leaves them. */
export function withoutMovieWatches(
	counts: MovieWatchCountDto[],
	movieId: string,
): MovieWatchCountDto[] {
	return counts.filter((count) => count.movieId !== movieId);
}
