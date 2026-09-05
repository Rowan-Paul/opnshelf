import type { FollowedActivityFeedDto } from "./dto/social.dto";

export type PaginatedResult<T> = {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

export const DEFAULT_SOCIAL_PAGE_SIZE = 20;
export const MAX_SOCIAL_PAGE_SIZE = 50;
export const DEFAULT_FEED_PAGE_SIZE = 10;
export const MAX_FEED_PAGE_SIZE = 25;
export const DEFAULT_WATCHERS_PAGE_SIZE = 3;
export const MAX_WATCHERS_PAGE_SIZE = 10;

export function clampPage(page: number) {
	return Math.max(page, 1);
}

export function clampPageSize(pageSize: number, maxPageSize: number) {
	return Math.min(Math.max(pageSize, 1), maxPageSize);
}

export function paginateItems<T>(
	items: T[],
	page: number,
	pageSize: number,
): PaginatedResult<T> {
	const pagination = getPaginationMeta(items.length, page, pageSize);
	const start = (pagination.page - 1) * pageSize;

	return {
		...pagination,
		items: items.slice(start, start + pageSize),
	};
}

export function getPaginationMeta(
	total: number,
	page: number,
	pageSize: number,
): Omit<PaginatedResult<never>, "items"> {
	const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
	const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;

	return {
		page: currentPage,
		pageSize,
		total,
		totalPages,
		hasNextPage: totalPages > 0 && currentPage < totalPages,
		hasPreviousPage: totalPages > 0 && currentPage > 1,
	};
}

export function emptyPaginatedResult(
	page: number,
	pageSize: number,
): FollowedActivityFeedDto {
	return {
		items: [],
		page,
		pageSize,
		total: 0,
		totalPages: 0,
		hasNextPage: false,
		hasPreviousPage: false,
	};
}
