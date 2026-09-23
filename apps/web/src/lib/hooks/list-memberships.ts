import {
	listsControllerGetListMembershipsOptions,
	listsControllerGetListMembershipsQueryKey,
} from "@opnshelf/api";

export {
	type ListItemRef,
	listsForItem,
	withMembership,
} from "@opnshelf/api";

/**
 * Every item in the viewer's lists, fetched once per page for all its posters.
 * Each card used to ask `/lists/for-item/...` for itself: 120 requests on a
 * signed-in search page, enough to trip the session rate limit (ADR 0040).
 */
export const listMembershipsQuery = () =>
	listsControllerGetListMembershipsOptions();

export const listMembershipsKey = () =>
	listsControllerGetListMembershipsQueryKey();
