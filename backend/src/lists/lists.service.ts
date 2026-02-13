import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
	$nsid as LIST_COLLECTION,
	main as listSchema,
} from "../lexicons/app/opnshelf/list";
import type { Main as ListRecord } from "../lexicons/app/opnshelf/list.defs";
import {
	$nsid as LIST_ITEM_COLLECTION,
	main as listItemSchema,
} from "../lexicons/app/opnshelf/listItem";
import type { Main as ListItemRecord } from "../lexicons/app/opnshelf/listItem.defs";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
	AddToListDto,
	CreateListDto,
	MovieInListDto,
	MovieListDto,
	MovieListSummaryDto,
	MovieListsForMovieDto,
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
		description: "Movies you want to watch",
	},
	{
		name: "Favorites",
		slug: "favorites",
		description: "Your favorite movies",
	},
];

@Injectable()
export class ListsService {
	private readonly logger = new Logger(ListsService.name);

	constructor(
		private prisma: PrismaService,
		private moviesService: MoviesService,
	) {}

	async getUserLists(userDid: string): Promise<MovieListSummaryDto[]> {
		const lists = await this.prisma.movieList.findMany({
			where: { userDid },
			orderBy: [{ isDefault: "asc" }, { createdAt: "asc" }],
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
					},
				},
			},
		});

		if (!list) {
			return null;
		}

		return this.mapListToDto(list);
	}

	async getListsForMovie(
		userDid: string,
		movieId: string,
	): Promise<MovieListsForMovieDto[]> {
		const lists = await this.prisma.movieList.findMany({
			where: { userDid },
			orderBy: [{ isDefault: "asc" }, { createdAt: "asc" }],
			include: {
				items: {
					where: { movieId },
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
	): Promise<MovieInListDto> {
		const list = await this.prisma.movieList.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		const existing = await this.prisma.movieListItem.findUnique({
			where: { listId_movieId: { listId: list.id, movieId: dto.movieId } },
			include: { movie: true },
		});

		if (existing) {
			return this.mapItemToDto(existing);
		}

		const movieData = await this.moviesService.getMovieDetails(dto.movieId);
		await this.moviesService.upsertMovie(movieData);

		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		const record: ListItemRecord = listItemSchema.build({
			listRkey: list.rkey,
			movieId: dto.movieId,
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

		this.logger.log(`Added movie ${dto.movieId} to list ${slug}`);

		const itemCount = await this.prisma.movieListItem.count({
			where: { listId: list.id },
		});

		const item = await this.prisma.movieListItem.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				listId: list.id,
				movieId: dto.movieId,
				notes: dto.notes,
				position: itemCount,
			},
			include: { movie: true },
		});

		return this.mapItemToDto(item);
	}

	async removeFromList(
		userDid: string,
		session: ATSession,
		slug: string,
		movieId: string,
	): Promise<void> {
		const list = await this.prisma.movieList.findFirst({
			where: { userDid, slug },
		});

		if (!list) {
			throw new NotFoundException("List not found");
		}

		const item = await this.prisma.movieListItem.findUnique({
			where: { listId_movieId: { listId: list.id, movieId } },
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

		await this.prisma.movieListItem.delete({
			where: { id: item.id },
		});

		this.logger.log(`Removed movie ${movieId} from list ${slug}`);
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

		const existingMovie = await this.moviesService.getMovieByTMDBId(
			record.movieId,
		);
		if (!existingMovie) {
			try {
				const movieData = await this.moviesService.getMovieDetails(
					record.movieId,
				);
				await this.moviesService.upsertMovie(movieData);
			} catch (err) {
				this.logger.error(
					`Failed to fetch movie ${record.movieId} from TMDB, skipping item`,
					err,
				);
				return;
			}
		}

		await this.prisma.movieListItem.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				listId: list.id,
				movieId: record.movieId,
				notes: record.notes,
			},
			update: {
				cid,
				notes: record.notes,
			},
		});

		this.logger.debug(`Indexed list item record: ${uri}`);
	}

	async deleteListItemRecord(rkey: string): Promise<void> {
		await this.prisma.movieListItem.deleteMany({
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
			movieId: string;
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
			};
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
		movieId: string;
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
		};
	}): MovieInListDto {
		return {
			id: item.id,
			rkey: item.rkey,
			movieId: item.movieId,
			notes: item.notes ?? undefined,
			position: item.position,
			createdAt: item.createdAt.toISOString(),
			movie: {
				movieId: item.movie.movieId,
				title: item.movie.title,
				posterPath: item.movie.posterPath ?? undefined,
				backdropPath: item.movie.backdropPath ?? undefined,
				releaseYear: item.movie.releaseYear ?? undefined,
				releaseDate: item.movie.releaseDate?.toISOString() ?? undefined,
				overview: item.movie.overview ?? undefined,
				colors:
					(item.movie.colors as MovieInListDto["movie"]["colors"]) ?? undefined,
			},
		};
	}
}
