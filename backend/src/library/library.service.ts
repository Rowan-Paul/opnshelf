import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger } from "@nestjs/common";
import {
	$nsid as LIBRARY_ITEM_COLLECTION,
	main as libraryItemSchema,
} from "../lexicons/xyz/opnshelf/library/item";
import type { Main as LibraryItemRecord } from "../lexicons/xyz/opnshelf/library/item.defs";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import type {
	AddToLibraryDto,
	LibraryFormat,
	LibraryItemDto,
	LibraryOwnershipDto,
} from "./dto/library.dto";
import { mapLibraryItemToDto } from "./library-mappers";

export interface ATSession {
	did: string;
}

type MediaType = "movie" | "show" | "season" | "episode";

@Injectable()
export class LibraryService {
	private readonly logger = new Logger(LibraryService.name);

	constructor(
		private prisma: PrismaService,
		private moviesService: MoviesService,
		private showsService: ShowsService,
	) {}

	async getUserLibrary(userDid: string): Promise<LibraryItemDto[]> {
		// ponytail: return the whole flat library, newest first. Personal-scale
		// collections; add pagination if a power user's library gets large.
		const items = await this.prisma.libraryItem.findMany({
			where: { userDid },
			orderBy: { createdAt: "desc" },
			include: { movie: true, show: true },
		});

		const episodeNames = await this.episodeNameMap(items);

		return items.map((item) =>
			mapLibraryItemToDto(item, this.episodeNameFor(item, episodeNames)),
		);
	}

	async getLibraryForItem(
		userDid: string,
		mediaType: MediaType,
		mediaId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	): Promise<LibraryOwnershipDto[]> {
		const items = await this.prisma.libraryItem.findMany({
			where: {
				userDid,
				mediaType,
				mediaId,
				seasonNumber: seasonNumber ?? 0,
				episodeNumber: episodeNumber ?? 0,
			},
			select: { rkey: true, format: true, boxSet: true },
			orderBy: { createdAt: "asc" },
		});

		return items.map((item) => ({
			rkey: item.rkey,
			format: item.format as LibraryFormat,
			boxSet: item.boxSet ?? undefined,
		}));
	}

	async addToLibrary(
		userDid: string,
		session: ATSession,
		dto: AddToLibraryDto,
	): Promise<LibraryItemDto> {
		const existing = await this.prisma.libraryItem.findFirst({
			where: {
				userDid,
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber ?? 0,
				episodeNumber: dto.episodeNumber ?? 0,
				format: dto.format,
			},
			include: { movie: true, show: true },
		});

		if (existing) {
			return mapLibraryItemToDto(existing);
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

		const record: LibraryItemRecord = libraryItemSchema.build({
			mediaType: dto.mediaType,
			mediaId: dto.mediaId,
			format: dto.format,
			seasonNumber: dto.seasonNumber,
			episodeNumber: dto.episodeNumber,
			boxSet: dto.boxSet,
			notes: dto.notes,
			createdAt: now,
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: LIBRARY_ITEM_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		this.logger.log(
			`Added ${dto.mediaType} ${dto.mediaId} (${dto.format}) to library`,
		);

		const item = await this.prisma.libraryItem.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				format: dto.format,
				seasonNumber: dto.seasonNumber ?? 0,
				episodeNumber: dto.episodeNumber ?? 0,
				movieId: dto.mediaType === "movie" ? dto.mediaId : null,
				showId: dto.mediaType === "movie" ? null : dto.mediaId,
				boxSet: dto.boxSet,
				notes: dto.notes,
			},
			include: { movie: true, show: true },
		});

		return mapLibraryItemToDto(item);
	}

	async removeFromLibrary(
		userDid: string,
		session: ATSession,
		mediaType: MediaType,
		mediaId: string,
		format: LibraryFormat,
		seasonNumber?: number,
		episodeNumber?: number,
	): Promise<void> {
		const item = await this.prisma.libraryItem.findFirst({
			where: {
				userDid,
				mediaType,
				mediaId,
				seasonNumber: seasonNumber ?? 0,
				episodeNumber: episodeNumber ?? 0,
				format,
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
			collection: LIBRARY_ITEM_COLLECTION,
			rkey: item.rkey,
		});

		await this.prisma.libraryItem.delete({ where: { id: item.id } });

		this.logger.log(`Removed ${mediaType} ${mediaId} (${format}) from library`);
	}

	async indexLibraryItemRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: LibraryItemRecord,
	): Promise<void> {
		const mediaType = record.mediaType;
		const mediaId = record.mediaId;
		const seasonNumber = record.seasonNumber ?? 0;
		const episodeNumber = record.episodeNumber ?? 0;

		if (mediaType === "movie") {
			const existingMovie = await this.moviesService.getMovieByTMDBId(mediaId);
			if (!existingMovie) {
				try {
					const movieData = await this.moviesService.getMovieDetails(mediaId);
					await this.moviesService.upsertMovie(movieData);
				} catch (err) {
					this.logger.error(
						`Failed to fetch movie ${mediaId} from TMDB, skipping library item`,
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
					this.logger.error(
						`Failed to fetch show ${mediaId} from TMDB, skipping library item`,
						err,
					);
					return;
				}
			}
		}

		await this.prisma.libraryItem.upsert({
			where: { userDid_rkey: { userDid, rkey } },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				mediaType,
				mediaId,
				format: record.format,
				seasonNumber,
				episodeNumber,
				movieId: mediaType === "movie" ? mediaId : null,
				showId: mediaType === "movie" ? null : mediaId,
				boxSet: record.boxSet,
				notes: record.notes,
			},
			update: {
				cid,
				mediaType,
				mediaId,
				format: record.format,
				seasonNumber,
				episodeNumber,
				movieId: mediaType === "movie" ? mediaId : null,
				showId: mediaType === "movie" ? null : mediaId,
				boxSet: record.boxSet,
				notes: record.notes,
			},
		});
	}

	async deleteLibraryItemRecord(userDid: string, rkey: string): Promise<void> {
		await this.prisma.libraryItem.deleteMany({ where: { userDid, rkey } });
	}

	private async episodeNameMap(
		items: Array<{
			mediaType: MediaType;
			mediaId: string;
			seasonNumber: number;
			episodeNumber: number;
			showId: string | null;
		}>,
	): Promise<Map<string, string>> {
		const episodeItems = items.filter(
			(item) => item.mediaType === "episode" && item.showId,
		);
		if (episodeItems.length === 0) return new Map();

		const episodes = await this.prisma.episode.findMany({
			where: {
				OR: episodeItems.map((item) => ({
					showId: item.mediaId,
					seasonNumber: item.seasonNumber,
					episodeNumber: item.episodeNumber,
				})),
			},
			select: {
				showId: true,
				seasonNumber: true,
				episodeNumber: true,
				name: true,
			},
		});

		return new Map(
			episodes.map((ep) => [
				`${ep.showId}:${ep.seasonNumber}:${ep.episodeNumber}`,
				ep.name,
			]),
		);
	}

	private episodeNameFor(
		item: {
			mediaType: MediaType;
			mediaId: string;
			seasonNumber: number;
			episodeNumber: number;
		},
		names: Map<string, string>,
	): string | undefined {
		if (item.mediaType !== "episode") return undefined;
		return names.get(
			`${item.mediaId}:${item.seasonNumber}:${item.episodeNumber}`,
		);
	}
}
