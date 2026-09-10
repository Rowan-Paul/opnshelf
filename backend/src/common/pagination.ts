import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * The one pagination contract every list endpoint speaks (ADR 0033). Requests
 * take `page` + `pageSize`; responses carry `items` plus this metadata. Clients
 * page by URL on Web and accumulate pages behind infinite scroll on Mobile from
 * the same fields, so no endpoint needs a second (cursor) dialect.
 */
export type PaginatedResult<T> = {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
/** TMDB list endpoints always return 20 results per page. */
export const TMDB_PAGE_SIZE = 20;

export const DEFAULT_SOCIAL_PAGE_SIZE = 20;
export const MAX_SOCIAL_PAGE_SIZE = 50;
export const DEFAULT_FEED_PAGE_SIZE = 10;
export const MAX_FEED_PAGE_SIZE = 25;
export const DEFAULT_WATCHERS_PAGE_SIZE = 3;
export const MAX_WATCHERS_PAGE_SIZE = 10;

/**
 * Query DTO for page-based endpoints. Extend it when an endpoint takes extra
 * filters; override `pageSize` in the subclass when its cap differs.
 */
export class PageQueryDto {
	@ApiPropertyOptional({
		description: "Page number to return (1-based)",
		default: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({
		description: "Number of items to return per page",
		default: DEFAULT_PAGE_SIZE,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(MAX_PAGE_SIZE)
	pageSize?: number;
}

/**
 * Response metadata shared by every paginated DTO. Subclasses add the typed
 * `items` array so Swagger can describe the element schema.
 */
export class PaginationMetaDto {
	@ApiProperty({ description: "Total count of items across all pages" })
	total: number;

	@ApiProperty({
		description: "Current page number after server-side clamping",
	})
	page: number;

	@ApiProperty({ description: "Number of items per page" })
	pageSize: number;

	@ApiProperty({ description: "Total number of available pages" })
	totalPages: number;

	@ApiProperty({ description: "Whether a next page exists" })
	hasNextPage: boolean;

	@ApiProperty({ description: "Whether a previous page exists" })
	hasPreviousPage: boolean;
}

export function clampPage(page: number) {
	return Math.max(page, 1);
}

export function clampPageSize(pageSize: number, maxPageSize: number) {
	return Math.min(Math.max(pageSize, 1), maxPageSize);
}

/**
 * Resolves a raw `page`/`pageSize` pair into the clamped values plus the
 * Prisma `skip`/`take` for that page. Pair with `getPaginationMeta` once the
 * total is known.
 */
export function resolvePageWindow(
	page: number | undefined,
	pageSize: number | undefined,
	{
		defaultPageSize = DEFAULT_PAGE_SIZE,
		maxPageSize = MAX_PAGE_SIZE,
	}: { defaultPageSize?: number; maxPageSize?: number } = {},
) {
	const safePage = clampPage(page ?? 1);
	const safePageSize = clampPageSize(pageSize ?? defaultPageSize, maxPageSize);
	return {
		page: safePage,
		pageSize: safePageSize,
		skip: (safePage - 1) * safePageSize,
		take: safePageSize,
	};
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

/** Shape of every TMDB list response the proxies pass through. */
export type TmdbPage<T> = {
	results: T[];
	page: number;
	total_results: number;
	total_pages: number;
};

/**
 * Re-expresses a TMDB page in the shared contract so the proxies (search,
 * discover, recommendations, person search) read like every other list.
 * `pageSize` is the combined width when several TMDB pages are merged.
 */
export function fromTmdbPage<T, R = T>(
	page: TmdbPage<T>,
	map: (item: T) => R = (item) => item as unknown as R,
	pageSize = TMDB_PAGE_SIZE,
): PaginatedResult<R> {
	return {
		items: page.results.map(map),
		page: page.page,
		pageSize,
		total: page.total_results,
		totalPages: page.total_pages,
		hasNextPage: page.total_pages > 0 && page.page < page.total_pages,
		hasPreviousPage: page.page > 1,
	};
}

export function emptyPaginatedResult(
	page: number,
	pageSize: number,
): PaginatedResult<never> {
	return {
		...getPaginationMeta(0, page, pageSize),
		items: [],
	};
}
