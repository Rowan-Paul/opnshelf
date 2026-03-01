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
	MovieListDto,
	MovieListSummaryDto,
	MovieListsForItemDto,
	UpdateListDto,
} from "./dto/list.dto";

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

@Injectable()
export class ListsService {
	private readonly logger = new Logger(ListsService.name);

	constructor(
		private prisma: PrismaService,
		private moviesService: MoviesService,
		private showsService: ShowsService,
	) {}

	async getUserLists(userDid: string): Promise<MovieListSummaryDto[]> {
		const lists = await this.prisma.movieList.findMany({
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
			movieCount: list._count.items,
			createdAt: list.createdAt.toISOString(),
			updatedAt: list.updatedAt.toISOString(),
		}));
	}

	async getList(userDid: string, slug: string): Promise<MovieListDto | null> {
		const list = await this.prisma.movieList.findFirst({
			where: { userDid, slug },
			include: {
				items: {
					orderBy: { createdAt: "desc" },
					include: {
						movie: true,
						show: true,
					},
				},
			},
		});

		if (!list) {
			return null;
		}

		return this.mapListToDto(list);
	}

	async getListsForItem(
		userDid: string,
		mediaType: "movie" | "show",
		mediaId: string,
	): Promise<MovieListsForItemDto[]> {
		const scopedMediaId =
			mediaType === "show" ? this.buildScopedShowMediaId(mediaId) : mediaId;

		const lists = await this.prisma.movieList.findMany({
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

	async ensureDefaultLists(
		userDid: string,
		session: ATSession,
	): Promise<MovieListDto[]> {
		const existingLists = await this.prisma.movieList.findMany({
			where: { userDid, isDefault: true },
		});

		const existingSlugs = new Set(existingLists.map((l) => l.slug));
		const listsToCreate = DEFAULT_LISTS.filter(
			(dl) => !existingSlugs.has(dl.slug),
		);

		for (const defaultList of listsToCreate) {
			await this.createDefaultList(userDid, session, defaultList);
		}

		const allLists = await this.prisma.movieList.findMany({
			where: { userDid, isDefault: true },
			orderBy: { createdAt: "asc" },
		});

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
	): Promise<MovieListDto> {
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

		const list = await this.prisma.movieList.create({
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
	): Promise<MovieListDto> {
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

		const list = await this.prisma.movieList.create({
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
	): Promise<MovieListDto> {
		const list = await this.prisma.movieList.findFirst({
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

		const updated = await this.prisma.movieList.update({
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
		const list = await this.prisma.movieList.findFirst({
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

		await this.prisma.movieList.delete({
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
		const list = await this.prisma.movieList.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		const scopedMediaId =
			dto.mediaType === "show"
				? this.buildScopedShowMediaId(dto.mediaId)
				: dto.mediaId;
		const showScope =
			dto.mediaType === "show"
				? this.parseScopedShowMediaId(scopedMediaId)
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
			return this.mapItemToDto(existing);
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

		return this.mapItemToDto(item);
	}

	async removeFromList(
		userDid: string,
		session: ATSession,
		slug: string,
		mediaType: "movie" | "show",
		mediaId: string,
	): Promise<void> {
		const scopedMediaId =
			mediaType === "show" ? this.buildScopedShowMediaId(mediaId) : mediaId;

		const list = await this.prisma.movieList.findFirst({
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
		await this.prisma.movieList.upsert({
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

		this.logger.debug(`Indexed list record: ${uri}`);
	}

	async deleteListRecord(rkey: string): Promise<void> {
		await this.prisma.movieList.deleteMany({
			where: { rkey },
		});

		this.logger.debug(`Deleted list record: ${rkey}`);
	}

	async indexListItemRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ListItemRecord,
	): Promise<void> {
		const list = await this.prisma.movieList.findFirst({
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
			const scopedShow = this.parseScopedShowMediaId(record.mediaId);
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
						? (this.parseScopedShowMediaId(record.mediaId)?.showId ??
							record.mediaId)
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
						? (this.parseScopedShowMediaId(record.mediaId)?.showId ??
							record.mediaId)
						: null,
				notes: record.notes,
			},
		});

		this.logger.debug(`Indexed list item record: ${uri}`);
	}

	async deleteListItemRecord(rkey: string): Promise<void> {
		await this.prisma.listItem.deleteMany({
			where: { rkey },
		});

		this.logger.debug(`Deleted list item record: ${rkey}`);
	}

	private generateSlug(name: string, userDid: string): string {
		const baseSlug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

		const uniqueSuffix = userDid.slice(-6);

		return `${baseSlug}-${uniqueSuffix}`;
	}

	private mapListToDto(list: {
		id: string;
		rkey: string;
		uri: string;
		userDid: string;
		name: string;
		description: string | null;
		slug: string;
		isDefault: boolean;
		createdAt: Date;
		updatedAt: Date;
		items: Array<{
			id: string;
			rkey: string;
			mediaType: "movie" | "show";
			mediaId: string;
			notes: string | null;
			position: number;
			createdAt: Date;
			movie: {
				movieId: string;
				title: string;
				posterPath: string | null;
				backdropPath: string | null;
				releaseYear: number | null;
				releaseDate: Date | null;
				overview: string | null;
				colors: unknown;
			} | null;
			show: {
				showId: string;
				title: string;
				posterPath: string | null;
				backdropPath: string | null;
				firstAirYear: number | null;
				firstAirDate: Date | null;
				overview: string | null;
				colors: unknown;
			} | null;
		}>;
	}): MovieListDto {
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
			items: list.items.map((item) => this.mapItemToDto(item)),
		};
	}

	private mapItemToDto(item: {
		id: string;
		rkey: string;
		mediaType: "movie" | "show";
		mediaId: string;
		notes: string | null;
		position: number;
		createdAt: Date;
		movie: {
			movieId: string;
			title: string;
			posterPath: string | null;
			backdropPath: string | null;
			releaseYear: number | null;
			releaseDate: Date | null;
			overview: string | null;
			colors: unknown;
		} | null;
		show: {
			showId: string;
			title: string;
			posterPath: string | null;
			backdropPath: string | null;
			firstAirYear: number | null;
			firstAirDate: Date | null;
			overview: string | null;
			colors: unknown;
		} | null;
	}): MediaInListDto {
		const parsedShowScope =
			item.mediaType === "show"
				? this.parseScopedShowMediaId(item.mediaId)
				: undefined;
		const baseMediaId =
			item.mediaType === "show"
				? (parsedShowScope?.showId ?? item.mediaId)
				: item.mediaId;
		const mediaTitle =
			item.mediaType === "movie" ? item.movie?.title : item.show?.title;
		const mediaPosterPath =
			item.mediaType === "movie"
				? item.movie?.posterPath
				: item.show?.posterPath;
		const mediaBackdropPath =
			item.mediaType === "movie"
				? item.movie?.backdropPath
				: item.show?.backdropPath;
		const mediaReleaseYear =
			item.mediaType === "movie"
				? item.movie?.releaseYear
				: item.show?.firstAirYear;
		const mediaReleaseDate =
			item.mediaType === "movie"
				? item.movie?.releaseDate
				: item.show?.firstAirDate;
		const mediaOverview =
			item.mediaType === "movie" ? item.movie?.overview : item.show?.overview;
		const mediaColors =
			item.mediaType === "movie" ? item.movie?.colors : item.show?.colors;

		return {
			id: item.id,
			rkey: item.rkey,
			mediaType: item.mediaType,
			mediaId: item.mediaId,
			seasonNumber: parsedShowScope?.seasonNumber,
			episodeNumber: parsedShowScope?.episodeNumber,
			movieId: item.mediaType === "movie" ? item.mediaId : undefined,
			notes: item.notes ?? undefined,
			position: item.position,
			createdAt: item.createdAt.toISOString(),
			media: {
				mediaType: item.mediaType,
				mediaId: baseMediaId,
				movieId: item.movie?.movieId,
				showId: item.show?.showId ?? parsedShowScope?.showId,
				seasonNumber: parsedShowScope?.seasonNumber,
				episodeNumber: parsedShowScope?.episodeNumber,
				title: mediaTitle ?? "",
				posterPath: mediaPosterPath ?? undefined,
				backdropPath: mediaBackdropPath ?? undefined,
				releaseYear: mediaReleaseYear ?? undefined,
				releaseDate: mediaReleaseDate?.toISOString() ?? undefined,
				overview: mediaOverview ?? undefined,
				colors: (mediaColors as MediaInListDto["media"]["colors"]) ?? undefined,
			},
			movie:
				item.mediaType === "movie"
					? {
							movieId: item.mediaId,
							title: mediaTitle ?? "",
							posterPath: mediaPosterPath ?? undefined,
							backdropPath: mediaBackdropPath ?? undefined,
							releaseYear: mediaReleaseYear ?? undefined,
							releaseDate: mediaReleaseDate?.toISOString() ?? undefined,
							overview: mediaOverview ?? undefined,
							colors:
								(mediaColors as MediaInListDto["media"]["colors"]) ?? undefined,
						}
					: undefined,
		};
	}

	private buildScopedShowMediaId(
		mediaId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	): string {
		const parsed = this.parseScopedShowMediaId(mediaId);
		if (parsed) {
			return mediaId;
		}

		if (typeof seasonNumber === "number" && Number.isFinite(seasonNumber)) {
			if (typeof episodeNumber === "number" && Number.isFinite(episodeNumber)) {
				return `${mediaId}:season:${seasonNumber}:episode:${episodeNumber}`;
			}
			return `${mediaId}:season:${seasonNumber}`;
		}

		return mediaId;
	}

	private parseScopedShowMediaId(mediaId: string):
		| {
				showId: string;
				seasonNumber?: number;
				episodeNumber?: number;
		  }
		| undefined {
		const episodeMatch = mediaId.match(/^([^:]+):season:(\d+):episode:(\d+)$/);
		if (episodeMatch) {
			return {
				showId: episodeMatch[1],
				seasonNumber: Number(episodeMatch[2]),
				episodeNumber: Number(episodeMatch[3]),
			};
		}

		const seasonMatch = mediaId.match(/^([^:]+):season:(\d+)$/);
		if (seasonMatch) {
			return {
				showId: seasonMatch[1],
				seasonNumber: Number(seasonMatch[2]),
			};
		}

		return undefined;
	}
}
