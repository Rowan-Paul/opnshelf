import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
	$nsid as LIST_COLLECTION,
	main as listSchema,
} from "../lexicons/xyz/opnshelf/list";
import type { Main as ListRecord } from "../lexicons/xyz/opnshelf/list.defs";
import {
	$nsid as LIST_ITEM_COLLECTION,
	main as listItemSchema,
} from "../lexicons/xyz/opnshelf/listItem";
import type { Main as ListItemRecord } from "../lexicons/xyz/opnshelf/listItem.defs";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import type {
	AddToListDto,
	CreateListDto,
	MediaInListDto,
	ListDto,
	ListSummaryDto,
	ListWithItemsDto,
	ListsForItemDto,
	UpdateListDto,
} from "./dto/list.dto";
import { mapItemToDto } from "./list-mappers";
import {
	buildScopedShowMediaId,
	parseScopedShowMediaId,
} from "./list-media-id.util";

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
			orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
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
		page?: number,
		pageSize?: number,
	): Promise<ListWithItemsDto | null> {
		return this.getList(userDid, slug, page, pageSize);
	}

	async getList(
		userDid: string,
		slug: string,
		page?: number,
		pageSize?: number,
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

		const items =
			total === 0
				? []
				: await this.prisma.listItem.findMany({
						where: { listId: list.id },
						orderBy: { createdAt: "desc" },
						include: {
							movie: true,
							show: true,
						},
						...(shouldPaginate && safePageSize
							? { skip: offset, take: safePageSize }
							: {}),
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
			items: items.map((item) => mapItemToDto(item)),
			total,
			page: currentPage,
			pageSize: shouldPaginate && safePageSize ? safePageSize : total,
			totalPages,
			hasPreviousPage: shouldPaginate && totalPages > 0 && currentPage > 1,
			hasNextPage: shouldPaginate && totalPages > 0 && currentPage < totalPages,
		};
	}

	async getListsForItem(
		userDid: string,
		mediaType: "movie" | "show",
		mediaId: string,
	): Promise<ListsForItemDto[]> {
		const scopedMediaId =
			mediaType === "show" ? buildScopedShowMediaId(mediaId) : mediaId;

		const lists = await this.prisma.list.findMany({
			where: { userDid },
			orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
			include: {
				items: {
					where: { mediaType, mediaId: scopedMediaId },
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

		const scopedMediaId =
			dto.mediaType === "show"
				? buildScopedShowMediaId(dto.mediaId)
				: dto.mediaId;
		const showScope =
			dto.mediaType === "show"
				? parseScopedShowMediaId(scopedMediaId)
				: undefined;

		const existing = await this.prisma.listItem.findUnique({
			where: {
				listId_mediaType_mediaId: {
					listId: list.id,
					mediaType: dto.mediaType,
					mediaId: scopedMediaId,
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
			const showData = await this.showsService.getShowDetails(
				showScope?.showId ?? dto.mediaId,
			);
			await this.showsService.upsertShow(showData);
		}

		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		const record: ListItemRecord = listItemSchema.build({
			listRkey: list.rkey,
			mediaType: dto.mediaType,
			mediaId: scopedMediaId,
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

		this.logger.log(`Added ${dto.mediaType} ${scopedMediaId} to list ${slug}`);

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
				mediaId: scopedMediaId,
				movieId: dto.mediaType === "movie" ? dto.mediaId : null,
				showId:
					dto.mediaType === "show" ? (showScope?.showId ?? dto.mediaId) : null,
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
		mediaType: "movie" | "show",
		mediaId: string,
	): Promise<void> {
		const scopedMediaId =
			mediaType === "show" ? buildScopedShowMediaId(mediaId) : mediaId;

		const list = await this.prisma.list.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		const item = await this.prisma.listItem.findUnique({
			where: {
				listId_mediaType_mediaId: {
					listId: list.id,
					mediaType,
					mediaId: scopedMediaId,
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

		this.logger.log(`Removed ${mediaType} ${scopedMediaId} from list ${slug}`);
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

		if (record.mediaType === "movie") {
			const existingMovie = await this.moviesService.getMovieByTMDBId(
				record.mediaId,
			);
			if (!existingMovie) {
				try {
					const movieData = await this.moviesService.getMovieDetails(
						record.mediaId,
					);
					await this.moviesService.upsertMovie(movieData);
				} catch (err) {
					this.logger.error(
						`Failed to fetch movie ${record.mediaId} from TMDB, skipping item`,
						err,
					);
					return;
				}
			}
		} else {
			const scopedShow = parseScopedShowMediaId(record.mediaId);
			const baseShowId = scopedShow?.showId ?? record.mediaId;
			const existingShow = await this.showsService.getShowByTMDBId(baseShowId);
			if (!existingShow) {
				try {
					const showData = await this.showsService.getShowDetails(baseShowId);
					await this.showsService.upsertShow(showData);
				} catch (err) {
					this.logger.error(
						`Failed to fetch show ${baseShowId} from TMDB, skipping item`,
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
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				movieId: record.mediaType === "movie" ? record.mediaId : null,
				showId:
					record.mediaType === "show"
						? (parseScopedShowMediaId(record.mediaId)?.showId ?? record.mediaId)
						: null,
				notes: record.notes,
			},
			update: {
				cid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				movieId: record.mediaType === "movie" ? record.mediaId : null,
				showId:
					record.mediaType === "show"
						? (parseScopedShowMediaId(record.mediaId)?.showId ?? record.mediaId)
						: null,
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
