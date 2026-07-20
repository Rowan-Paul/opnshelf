import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	$nsid as LIST_COLLECTION,
	main as listSchema,
} from "../lexicons/xyz/opnshelf/list";
import type { Main as ListRecord } from "../lexicons/xyz/opnshelf/list.defs";
import {
	$nsid as LIST_ITEM_COLLECTION,
	main as listItemSchema,
} from "../lexicons/xyz/opnshelf/list/item";
import type { Main as ListItemRecord } from "../lexicons/xyz/opnshelf/list/item.defs";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import { TmdbServiceError } from "../tmdb/tmdb-http";
import type {
	AddToListDto,
	CreateListDto,
	ListSort,
	MediaInListDto,
	ListDto,
	ListSummaryDto,
	ListWithItemsDto,
	ListsForItemDto,
	UpdateListDto,
} from "./dto/list.dto";
import { mapItemToDto } from "./list-mappers";

type ItemScope = {
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	seasonNumber: number;
	episodeNumber: number;
};

export interface ATSession {
	did: string;
}

const DEFAULT_LISTS: Array<{
	name: string;
	slug: string;
	description: string;
}> = [
	{
		name: "Watchlist",
		slug: "watchlist",
		description: "Items you want to watch",
	},
	{
		name: "Favorites",
		slug: "favorites",
		description: "Your favorite items",
	},
];
const DEFAULT_LIST_SLUGS = new Set(DEFAULT_LISTS.map((list) => list.slug));
const LIST_RECORDS_PAGE_SIZE = 100;

@Injectable()
export class ListsService {
	private readonly logger = new Logger(ListsService.name);

	constructor(
		private prisma: PrismaService,
		private moviesService: MoviesService,
		private showsService: ShowsService,
	) {}

	async getUserLists(userDid: string): Promise<ListSummaryDto[]> {
		const lists = await this.prisma.list.findMany({
			where: { userDid },
			orderBy: [{ isDefault: "desc" }, { name: "asc" }],
			include: {
				_count: { select: { items: true } },
			},
		});

		return lists.map((list) => ({
			id: list.id,
			rkey: list.rkey,
			name: list.name,
			description: list.description ?? undefined,
			slug: list.slug,
			isDefault: list.isDefault,
			itemCount: list._count.items,
			createdAt: list.createdAt.toISOString(),
			updatedAt: list.updatedAt.toISOString(),
		}));
	}

	async getPublicUserLists(userDid: string): Promise<ListSummaryDto[]> {
		return this.getUserLists(userDid);
	}

	async getPublicList(
		userDid: string,
		slug: string,
		viewerDid: string | null,
		page?: number,
		pageSize?: number,
		sort?: ListSort,
	): Promise<ListWithItemsDto | null> {
		return this.getList(userDid, slug, viewerDid, page, pageSize, sort);
	}

	async getList(
		userDid: string,
		slug: string,
		viewerDid: string | null,
		page?: number,
		pageSize?: number,
		sort: ListSort = "position",
	): Promise<ListWithItemsDto | null> {
		const shouldPaginate = page !== undefined || pageSize !== undefined;
		const safePageSize = shouldPaginate
			? Math.min(Math.max(pageSize ?? 20, 1), 50)
			: undefined;
		const requestedPage = Math.max(page ?? 1, 1);

		const list = await this.prisma.list.findFirst({
			where: { userDid, slug },
			include: {
				_count: {
					select: { items: true },
				},
			},
		});

		if (!list) {
			return null;
		}

		const total = list._count.items;
		const totalPages =
			shouldPaginate && safePageSize
				? total > 0
					? Math.ceil(total / safePageSize)
					: 0
				: total > 0
					? 1
					: 0;
		const currentPage =
			shouldPaginate && totalPages > 0
				? Math.min(requestedPage, totalPages)
				: 1;
		const offset =
			shouldPaginate && safePageSize ? (currentPage - 1) * safePageSize : 0;

		const watchState = await this.buildWatchState(viewerDid, list.id);

		// `title`/`year` sort across a mix of movie + show relations can't be
		// expressed as a single deterministic Prisma orderBy, so we sort the whole
		// (bounded, user-curated) list in memory and slice the page. `position`
		// and `added` are plain columns and paginate in the DB.
		const usesRelationSort = sort === "title" || sort === "year";

		let items: Awaited<ReturnType<ListsService["fetchItemsForSort"]>>;
		if (total === 0) {
			items = [];
		} else if (usesRelationSort) {
			const allItems = await this.fetchItemsForSort(list.id);
			allItems.sort(this.compareBySort(sort));
			items =
				shouldPaginate && safePageSize
					? allItems.slice(offset, offset + safePageSize)
					: allItems;
		} else {
			items = await this.prisma.listItem.findMany({
				where: { listId: list.id },
				orderBy:
					sort === "added"
						? [{ createdAt: "desc" }]
						: // `position` (default) is insertion/manual order; createdAt is a
							// deterministic tiebreak for rows that share a position (possible
							// from concurrent adds before any manual reorder).
							[{ position: "asc" }, { createdAt: "asc" }],
				include: {
					movie: true,
					show: true,
				},
				...(shouldPaginate && safePageSize
					? { skip: offset, take: safePageSize }
					: {}),
			});
		}

		const episodeItems = items.filter(
			(item) => item.mediaType === "episode" && item.showId,
		);
		const episodeKeys = episodeItems.map((item) => ({
			showId: item.mediaId,
			seasonNumber: item.seasonNumber,
			episodeNumber: item.episodeNumber,
		}));

		const episodes =
			episodeKeys.length > 0
				? await this.prisma.episode.findMany({
						where: {
							OR: episodeKeys.map((k) => ({
								showId: k.showId,
								seasonNumber: k.seasonNumber,
								episodeNumber: k.episodeNumber,
							})),
						},
						select: {
							showId: true,
							seasonNumber: true,
							episodeNumber: true,
							name: true,
						},
					})
				: [];

		const episodeMap = new Map(
			episodes.map((ep) => [
				`${ep.showId}:${ep.seasonNumber}:${ep.episodeNumber}`,
				ep.name,
			]),
		);

		return {
			id: list.id,
			rkey: list.rkey,
			uri: list.uri,
			userDid: list.userDid,
			name: list.name,
			description: list.description ?? undefined,
			slug: list.slug,
			isDefault: list.isDefault,
			createdAt: list.createdAt.toISOString(),
			updatedAt: list.updatedAt.toISOString(),
			items: items.map((item) => {
				const episodeName =
					item.mediaType === "episode"
						? episodeMap.get(
								`${item.mediaId}:${item.seasonNumber}:${item.episodeNumber}`,
							)
						: undefined;
				return mapItemToDto(item, episodeName, watchState.isWatched(item));
			}),
			total,
			watchedCount: watchState.watchedCount,
			page: currentPage,
			pageSize: shouldPaginate && safePageSize ? safePageSize : total,
			totalPages,
			hasPreviousPage: shouldPaginate && totalPages > 0 && currentPage > 1,
			hasNextPage: shouldPaginate && totalPages > 0 && currentPage < totalPages,
		};
	}

	private fetchItemsForSort(listId: string) {
		return this.prisma.listItem.findMany({
			where: { listId },
			include: { movie: true, show: true },
		});
	}

	private compareBySort(
		sort: "title" | "year",
	): (
		a: Awaited<ReturnType<ListsService["fetchItemsForSort"]>>[number],
		b: Awaited<ReturnType<ListsService["fetchItemsForSort"]>>[number],
	) => number {
		const titleOf = (
			item: Awaited<ReturnType<ListsService["fetchItemsForSort"]>>[number],
		): string =>
			(item.mediaType === "movie" ? item.movie?.title : item.show?.title) ?? "";
		const yearOf = (
			item: Awaited<ReturnType<ListsService["fetchItemsForSort"]>>[number],
		): number | null =>
			item.mediaType === "movie"
				? (item.movie?.releaseYear ?? null)
				: (item.show?.firstAirYear ?? null);

		return (a, b) => {
			if (sort === "title") {
				const cmp = titleOf(a).localeCompare(titleOf(b), undefined, {
					sensitivity: "base",
				});
				if (cmp !== 0) return cmp;
			} else {
				const ay = yearOf(a);
				const by = yearOf(b);
				// Nulls sort last regardless of direction.
				if (ay === null && by !== null) return 1;
				if (ay !== null && by === null) return -1;
				if (ay !== null && by !== null && ay !== by) return ay - by;
			}
			// Deterministic tiebreak.
			return a.createdAt.getTime() - b.createdAt.getTime();
		};
	}

	/**
	 * Builds viewer-relative watched lookups for a whole list in a fixed number
	 * of queries (independent of page size). Returns a predicate for per-item
	 * `watched` and the list-wide `watchedCount`. When there is no viewer
	 * (unauthenticated public request) everything is unwatched.
	 */
	private async buildWatchState(
		viewerDid: string | null,
		listId: string,
	): Promise<{
		isWatched: (item: ItemScope) => boolean;
		watchedCount: number;
	}> {
		if (!viewerDid) {
			return { isWatched: () => false, watchedCount: 0 };
		}

		const scopes = await this.prisma.listItem.findMany({
			where: { listId },
			select: {
				mediaType: true,
				mediaId: true,
				seasonNumber: true,
				episodeNumber: true,
			},
		});

		if (scopes.length === 0) {
			return { isWatched: () => false, watchedCount: 0 };
		}

		const movieIds = [
			...new Set(
				scopes.filter((s) => s.mediaType === "movie").map((s) => s.mediaId),
			),
		];
		const showIds = [
			...new Set(
				scopes.filter((s) => s.mediaType !== "movie").map((s) => s.mediaId),
			),
		];

		const [watchedMovies, watchedEpisodes] = await Promise.all([
			movieIds.length > 0
				? this.prisma.trackedMovie.findMany({
						where: {
							userDid: viewerDid,
							status: "watched",
							movieId: { in: movieIds },
						},
						select: { movieId: true },
					})
				: Promise.resolve([]),
			showIds.length > 0
				? this.prisma.trackedEpisode.findMany({
						where: {
							userDid: viewerDid,
							status: "watched",
							showId: { in: showIds },
						},
						select: {
							showId: true,
							seasonNumber: true,
							episodeNumber: true,
						},
					})
				: Promise.resolve([]),
		]);

		const watchedMovieIds = new Set(watchedMovies.map((m) => m.movieId));
		const watchedShows = new Set<string>();
		const watchedSeasons = new Set<string>();
		const watchedEpisodeKeys = new Set<string>();
		for (const ep of watchedEpisodes) {
			watchedShows.add(ep.showId);
			watchedSeasons.add(`${ep.showId}:${ep.seasonNumber}`);
			watchedEpisodeKeys.add(
				`${ep.showId}:${ep.seasonNumber}:${ep.episodeNumber}`,
			);
		}

		const isWatched = (item: ItemScope): boolean => {
			switch (item.mediaType) {
				case "movie":
					return watchedMovieIds.has(item.mediaId);
				case "show":
					return watchedShows.has(item.mediaId);
				case "season":
					return watchedSeasons.has(`${item.mediaId}:${item.seasonNumber}`);
				case "episode":
					return watchedEpisodeKeys.has(
						`${item.mediaId}:${item.seasonNumber}:${item.episodeNumber}`,
					);
				default:
					return false;
			}
		};

		const watchedCount = scopes.reduce(
			(count, scope) => count + (isWatched(scope) ? 1 : 0),
			0,
		);

		return { isWatched, watchedCount };
	}

	/**
	 * Reassigns list-item positions to match the given full ordering. Owner-only.
	 * `position` is a DB-only projection (not part of the AT Protocol list-item
	 * record), so reordering does NOT touch the PDS.
	 */
	async reorderListItems(
		userDid: string,
		slug: string,
		ids: string[],
	): Promise<void> {
		const list = await this.prisma.list.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		const existing = await this.prisma.listItem.findMany({
			where: { listId: list.id },
			select: { id: true },
		});
		const existingIds = new Set(existing.map((item) => item.id));

		if (ids.length !== existingIds.size) {
			throw new BadRequestException(
				"ids must contain every item in the list exactly once",
			);
		}

		const seen = new Set<string>();
		for (const id of ids) {
			if (!existingIds.has(id)) {
				throw new BadRequestException(
					`Item ${id} does not belong to this list`,
				);
			}
			if (seen.has(id)) {
				throw new BadRequestException(`Duplicate item id ${id}`);
			}
			seen.add(id);
		}

		await this.prisma.$transaction(
			ids.map((id, index) =>
				this.prisma.listItem.update({
					where: { id },
					data: { position: index },
				}),
			),
		);

		this.logger.log(`Reordered ${ids.length} items in list ${slug}`);
	}

	async getListsForItem(
		userDid: string,
		mediaType: "movie" | "show" | "season" | "episode",
		mediaId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	): Promise<ListsForItemDto[]> {
		const lists = await this.prisma.list.findMany({
			where: { userDid },
			orderBy: [{ isDefault: "desc" }, { name: "asc" }],
			include: {
				items: {
					where: {
						mediaType,
						mediaId,
						seasonNumber: seasonNumber ?? 0,
						episodeNumber: episodeNumber ?? 0,
					},
					select: { id: true },
				},
			},
		});

		return lists.map((list) => ({
			listId: list.id,
			listName: list.name,
			listSlug: list.slug,
			isDefault: list.isDefault,
			isInList: list.items.length > 0,
		}));
	}

	async hasAllDefaultLists(userDid: string): Promise<boolean> {
		const defaultLists = await this.prisma.list.findMany({
			where: { userDid, isDefault: true },
			select: { slug: true },
		});
		const existingSlugs = new Set(defaultLists.map((list) => list.slug));

		return DEFAULT_LISTS.every((list) => existingSlugs.has(list.slug));
	}

	async provisionDefaultLists(
		userDid: string,
		session: ATSession,
	): Promise<ListDto[]> {
		const existingLists = await this.prisma.list.findMany({
			where: { userDid, isDefault: true },
		});
		const hydratedLists = [...existingLists];

		const existingSlugs = new Set(existingLists.map((l) => l.slug));

		if (existingSlugs.size < DEFAULT_LISTS.length) {
			const repoDefaults = await this.listRepoDefaultLists(userDid, session);

			for (const repoDefault of repoDefaults) {
				if (existingSlugs.has(repoDefault.slug)) {
					continue;
				}

				const indexedDefault = await this.prisma.list.upsert({
					where: { rkey: repoDefault.rkey },
					create: {
						rkey: repoDefault.rkey,
						uri: repoDefault.uri,
						cid: repoDefault.cid,
						userDid,
						name: repoDefault.name,
						description: repoDefault.description,
						slug: repoDefault.slug,
						isDefault: true,
					},
					update: {
						uri: repoDefault.uri,
						cid: repoDefault.cid,
						name: repoDefault.name,
						description: repoDefault.description,
						slug: repoDefault.slug,
						isDefault: true,
					},
				});

				hydratedLists.push(indexedDefault);
				existingSlugs.add(repoDefault.slug);
			}
		}

		const listsToCreate = DEFAULT_LISTS.filter(
			(dl) => !existingSlugs.has(dl.slug),
		);

		for (const defaultList of listsToCreate) {
			const createdDefault = await this.createDefaultList(
				userDid,
				session,
				defaultList,
			);
			hydratedLists.push({
				id: createdDefault.id,
				rkey: createdDefault.rkey,
				uri: createdDefault.uri,
				cid: null,
				userDid: createdDefault.userDid,
				name: createdDefault.name,
				description: createdDefault.description ?? null,
				slug: createdDefault.slug,
				isDefault: createdDefault.isDefault,
				createdAt: new Date(createdDefault.createdAt),
				updatedAt: new Date(createdDefault.updatedAt),
			});
			existingSlugs.add(defaultList.slug);
		}

		const allLists =
			listsToCreate.length > 0 || hydratedLists.length !== existingLists.length
				? await this.prisma.list.findMany({
						where: { userDid, isDefault: true },
						orderBy: { createdAt: "asc" },
					})
				: hydratedLists.sort(
						(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
					);

		return allLists.map((list) => ({
			id: list.id,
			rkey: list.rkey,
			uri: list.uri,
			userDid: list.userDid,
			name: list.name,
			description: list.description ?? undefined,
			slug: list.slug,
			isDefault: list.isDefault,
			createdAt: list.createdAt.toISOString(),
			updatedAt: list.updatedAt.toISOString(),
		}));
	}

	private async createDefaultList(
		userDid: string,
		session: ATSession,
		defaultList: { name: string; slug: string; description: string },
	): Promise<ListDto> {
		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		const record: ListRecord = listSchema.build({
			name: defaultList.name,
			description: defaultList.description,
			slug: defaultList.slug,
			isDefault: true,
			createdAt: now,
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: LIST_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		this.logger.log(`Created default list: ${response.data.uri}`);

		const list = await this.prisma.list.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				name: defaultList.name,
				description: defaultList.description,
				slug: defaultList.slug,
				isDefault: true,
			},
		});

		return {
			id: list.id,
			rkey: list.rkey,
			uri: list.uri,
			userDid: list.userDid,
			name: list.name,
			description: list.description ?? undefined,
			slug: list.slug,
			isDefault: list.isDefault,
			createdAt: list.createdAt.toISOString(),
			updatedAt: list.updatedAt.toISOString(),
		};
	}

	async createList(
		userDid: string,
		session: ATSession,
		dto: CreateListDto,
	): Promise<ListDto> {
		const slug = this.generateSlug(dto.name, userDid);

		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		const record: ListRecord = listSchema.build({
			name: dto.name,
			description: dto.description,
			slug,
			isDefault: false,
			createdAt: now,
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: LIST_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		this.logger.log(`Created AT list record: ${response.data.uri}`);

		const list = await this.prisma.list.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				name: dto.name,
				description: dto.description,
				slug,
				isDefault: false,
			},
		});

		return {
			id: list.id,
			rkey: list.rkey,
			uri: list.uri,
			userDid: list.userDid,
			name: list.name,
			description: list.description ?? undefined,
			slug: list.slug,
			isDefault: list.isDefault,
			createdAt: list.createdAt.toISOString(),
			updatedAt: list.updatedAt.toISOString(),
		};
	}

	async updateList(
		userDid: string,
		session: ATSession,
		slug: string,
		dto: UpdateListDto,
	): Promise<ListDto> {
		const list = await this.prisma.list.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		const newName = dto.name ?? list.name;
		const newDescription = dto.description ?? list.description;
		const newSlug =
			dto.name && dto.name !== list.name
				? this.generateSlug(dto.name, userDid)
				: list.slug;

		const _now = new Date().toISOString();

		const record: ListRecord = listSchema.build({
			name: newName,
			description: newDescription ?? undefined,
			slug: newSlug,
			isDefault: list.isDefault,
			createdAt: list.createdAt.toISOString(),
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: LIST_COLLECTION,
			rkey: list.rkey,
			record,
			validate: false,
		});

		const updated = await this.prisma.list.update({
			where: { id: list.id },
			data: {
				name: newName,
				description: newDescription,
				slug: newSlug,
			},
		});

		return {
			id: updated.id,
			rkey: updated.rkey,
			uri: updated.uri,
			userDid: updated.userDid,
			name: updated.name,
			description: updated.description ?? undefined,
			slug: updated.slug,
			isDefault: updated.isDefault,
			createdAt: updated.createdAt.toISOString(),
			updatedAt: updated.updatedAt.toISOString(),
		};
	}

	async deleteList(
		userDid: string,
		session: ATSession,
		slug: string,
	): Promise<void> {
		const list = await this.prisma.list.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		if (list.isDefault) {
			throw new Error("Cannot delete default lists");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: LIST_COLLECTION,
			rkey: list.rkey,
		});

		await this.prisma.list.delete({
			where: { id: list.id },
		});

		this.logger.log(`Deleted list ${slug} for user ${userDid}`);
	}

	async addToList(
		userDid: string,
		session: ATSession,
		slug: string,
		dto: AddToListDto,
	): Promise<MediaInListDto> {
		const list = await this.prisma.list.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		const showId = dto.mediaType === "movie" ? null : dto.mediaId;

		const existing = await this.prisma.listItem.findUnique({
			where: {
				listId_mediaType_mediaId_seasonNumber_episodeNumber: {
					listId: list.id,
					mediaType: dto.mediaType,
					mediaId: dto.mediaId,
					seasonNumber: dto.seasonNumber ?? 0,
					episodeNumber: dto.episodeNumber ?? 0,
				},
			},
			include: { movie: true, show: true },
		});

		if (existing) {
			return mapItemToDto(existing);
		}

		if (dto.mediaType === "movie") {
			const movieData = await this.moviesService.getMovieDetails(dto.mediaId);
			await this.moviesService.upsertMovie(movieData);
		} else {
			const showData = await this.showsService.getShowDetails(dto.mediaId);
			await this.showsService.upsertShow(showData);
		}

		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		const record: ListItemRecord = listItemSchema.build({
			listRkey: list.rkey,
			mediaType: dto.mediaType,
			mediaId: dto.mediaId,
			seasonNumber: dto.seasonNumber,
			episodeNumber: dto.episodeNumber,
			notes: dto.notes,
			createdAt: now,
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: LIST_ITEM_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		this.logger.log(`Added ${dto.mediaType} ${dto.mediaId} to list ${slug}`);

		const itemCount = await this.prisma.listItem.count({
			where: { listId: list.id },
		});

		const item = await this.prisma.listItem.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				listId: list.id,
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber ?? 0,
				episodeNumber: dto.episodeNumber ?? 0,
				movieId: dto.mediaType === "movie" ? dto.mediaId : null,
				showId: dto.mediaType === "movie" ? null : showId,
				notes: dto.notes,
				position: itemCount,
			},
			include: { movie: true, show: true },
		});

		return mapItemToDto(item);
	}

	async removeFromList(
		userDid: string,
		session: ATSession,
		slug: string,
		mediaType: "movie" | "show" | "season" | "episode",
		mediaId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	): Promise<void> {
		const list = await this.prisma.list.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		const item = await this.prisma.listItem.findUnique({
			where: {
				listId_mediaType_mediaId_seasonNumber_episodeNumber: {
					listId: list.id,
					mediaType,
					mediaId,
					seasonNumber: seasonNumber ?? 0,
					episodeNumber: episodeNumber ?? 0,
				},
			},
		});

		if (!item) {
			return;
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: LIST_ITEM_COLLECTION,
			rkey: item.rkey,
		});

		await this.prisma.listItem.delete({
			where: { id: item.id },
		});

		this.logger.log(`Removed ${mediaType} ${mediaId} from list ${slug}`);
	}

	async indexListRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ListRecord,
	): Promise<void> {
		await this.prisma.list.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				name: record.name,
				description: record.description,
				slug: record.slug,
				isDefault: record.isDefault,
			},
			update: {
				cid,
				name: record.name,
				description: record.description,
				slug: record.slug,
				isDefault: record.isDefault,
			},
		});
	}

	async deleteListRecord(rkey: string): Promise<void> {
		await this.prisma.list.deleteMany({
			where: { rkey },
		});
	}

	async indexListItemRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ListItemRecord,
	): Promise<void> {
		const list = await this.prisma.list.findFirst({
			where: { userDid, rkey: record.listRkey },
		});

		if (!list) {
			this.logger.warn(
				`List not found for listRkey ${record.listRkey}, skipping item`,
			);
			return;
		}

		// Backward compatibility: normalize old-format scoped show IDs
		let mediaType = record.mediaType;
		let mediaId = record.mediaId;
		let seasonNumber = record.seasonNumber ?? 0;
		let episodeNumber = record.episodeNumber ?? 0;

		if (mediaType === "show" && mediaId.includes(":")) {
			const episodeMatch = mediaId.match(
				/^([^:]+):season:(\d+):episode:(\d+)$/,
			);
			if (episodeMatch) {
				mediaId = episodeMatch[1];
				seasonNumber = Number(episodeMatch[2]);
				episodeNumber = Number(episodeMatch[3]);
				mediaType = "episode";
			} else {
				const seasonMatch = mediaId.match(/^([^:]+):season:(\d+)$/);
				if (seasonMatch) {
					mediaId = seasonMatch[1];
					seasonNumber = Number(seasonMatch[2]);
					mediaType = "season";
				}
			}
		}

		if (mediaType === "movie") {
			const existingMovie = await this.moviesService.getMovieByTMDBId(mediaId);
			if (!existingMovie) {
				try {
					const movieData = await this.moviesService.getMovieDetails(mediaId);
					await this.moviesService.upsertMovie(movieData);
				} catch (err) {
					if (err instanceof TmdbServiceError) throw err;
					this.logger.error(
						`Failed to fetch movie ${mediaId} from TMDB, skipping item`,
						err,
					);
					return;
				}
			}
		} else {
			const existingShow = await this.showsService.getShowByTMDBId(mediaId);
			if (!existingShow) {
				try {
					const showData = await this.showsService.getShowDetails(mediaId);
					await this.showsService.upsertShow(showData);
				} catch (err) {
					if (err instanceof TmdbServiceError) throw err;
					this.logger.error(
						`Failed to fetch show ${mediaId} from TMDB, skipping item`,
						err,
					);
					return;
				}
			}
		}

		await this.prisma.listItem.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				listId: list.id,
				mediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
				movieId: mediaType === "movie" ? mediaId : null,
				showId: mediaType === "movie" ? null : mediaId,
				notes: record.notes,
			},
			update: {
				cid,
				mediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
				movieId: mediaType === "movie" ? mediaId : null,
				showId: mediaType === "movie" ? null : mediaId,
				notes: record.notes,
			},
		});
	}

	async deleteListItemRecord(rkey: string): Promise<void> {
		await this.prisma.listItem.deleteMany({
			where: { rkey },
		});
	}

	private generateSlug(name: string, userDid: string): string {
		const baseSlug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

		const uniqueSuffix = userDid.slice(-6);

		return `${baseSlug}-${uniqueSuffix}`;
	}

	private async listRepoDefaultLists(
		_userDid: string,
		session: ATSession,
	): Promise<
		Array<{
			rkey: string;
			uri: string;
			cid: string;
			name: string;
			description?: string;
			slug: string;
		}>
	> {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const repoDefaults: Array<{
			rkey: string;
			uri: string;
			cid: string;
			name: string;
			description?: string;
			slug: string;
		}> = [];
		let cursor: string | undefined;

		do {
			const response = await agent.com.atproto.repo.listRecords({
				repo: session.did,
				collection: LIST_COLLECTION,
				limit: LIST_RECORDS_PAGE_SIZE,
				cursor,
			});

			for (const record of response.data.records) {
				let parsedRecord: ListRecord;
				try {
					parsedRecord = listSchema.parse(record.value);
				} catch {
					continue;
				}

				if (
					!parsedRecord.isDefault ||
					!DEFAULT_LIST_SLUGS.has(parsedRecord.slug)
				) {
					continue;
				}

				repoDefaults.push({
					rkey: this.extractRkeyFromUri(record.uri, session.did),
					uri: record.uri,
					cid: record.cid,
					name: parsedRecord.name,
					description: parsedRecord.description,
					slug: parsedRecord.slug,
				});
			}

			cursor = response.data.cursor;
		} while (cursor);

		return repoDefaults;
	}

	private extractRkeyFromUri(uri: string, userDid: string): string {
		const prefix = `at://${userDid}/${LIST_COLLECTION}/`;

		if (!uri.startsWith(prefix)) {
			throw new Error(`Unexpected list URI returned from repo: ${uri}`);
		}

		return uri.slice(prefix.length);
	}
}
