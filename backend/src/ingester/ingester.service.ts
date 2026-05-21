import {
	type IdentityEvent,
	type RecordEvent,
	SimpleIndexer,
	Tap,
} from "@atproto/tap";
import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	$nsid as FOLLOW_COLLECTION,
	main as followSchema,
} from "../lexicons/xyz/opnshelf/follow";
import type { Main as FollowRecord } from "../lexicons/xyz/opnshelf/follow.defs";
import {
	$nsid as PROFILE_COLLECTION,
	main as profileSchema,
} from "../lexicons/xyz/opnshelf/profile.defs";
import type { Main as ProfileRecord } from "../lexicons/xyz/opnshelf/profile.defs";
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
import {
	$nsid as EPISODE_COLLECTION,
	main as episodeSchema,
} from "../lexicons/xyz/opnshelf/episode";
import type { Main as EpisodeRecord } from "../lexicons/xyz/opnshelf/episode.defs";
import {
	$nsid as MOVIE_COLLECTION,
	main as movieSchema,
} from "../lexicons/xyz/opnshelf/movie";
import type { Main as MovieRecord } from "../lexicons/xyz/opnshelf/movie.defs";
import { ListsService } from "../lists/lists.service";
import { MoviesService } from "../movies/movies.service";
import {
	$nsid as NOTE_COLLECTION,
	main as noteSchema,
} from "../lexicons/xyz/opnshelf/note";
import type { Main as NoteRecord } from "../lexicons/xyz/opnshelf/note.defs";
import { NotesService } from "../notes/notes.service";
import { PrismaService } from "../prisma/prisma.service";
import {
	$nsid as REVIEW_COLLECTION,
	main as reviewSchema,
} from "../lexicons/xyz/opnshelf/review";
import type { Main as ReviewRecord } from "../lexicons/xyz/opnshelf/review.defs";
import {
	$nsid as REVIEW_LIKE_COLLECTION,
	main as reviewLikeSchema,
} from "../lexicons/xyz/opnshelf/review/like";
import type { Main as ReviewLikeRecord } from "../lexicons/xyz/opnshelf/review/like.defs";
import { ReviewsService } from "../reviews/reviews.service";
import { SocialService } from "../social/social.service";
import { ShowsService } from "../shows/shows.service";
import { ProfileService } from "../users/profile.service";

@Injectable()
export class IngesterService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(IngesterService.name);
	private tap: Tap | null = null;
	private channel: ReturnType<Tap["channel"]> | null = null;
	private readonly tapUrl: string;
	private readonly tapAdminPassword: string | undefined;

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
		private readonly moviesService: MoviesService,
		private readonly showsService: ShowsService,
		private readonly listsService: ListsService,
		private readonly notesService: NotesService,
		private readonly reviewsService: ReviewsService,
		private readonly socialService: SocialService,
		private readonly profileService: ProfileService,
	) {
		this.tapUrl = this.config.get<string>("TAP_URL") ?? "http://localhost:2480";
		this.tapAdminPassword = this.config.get<string>("TAP_ADMIN_PASSWORD");
	}

	onModuleInit() {
		try {
			// Start the ingester (non-blocking)
			this.startIngester();
			// Wait a moment for the channel to start connecting, then register repos
			setTimeout(() => {
				void this.registerExistingUsers();
			}, 1000);
		} catch (e) {
			this.logger.error("TAP init failed; continuing without ingester", e);
		}
	}

	async onModuleDestroy() {
		await this.stopIngester();
	}

	private startIngester(): void {
		this.logger.log(`Starting TAP ingester, connecting to ${this.tapUrl}`);

		// Initialize TAP client with optional admin password for authentication
		this.tap = new Tap(this.tapUrl, {
			adminPassword: this.tapAdminPassword,
		});

		// Create indexer to handle events
		const indexer = new SimpleIndexer();

		// Handle record events (create, update, delete)
		indexer.record(async (evt: RecordEvent) => {
			try {
				await this.handleRecordEvent(evt);
			} catch (err) {
				this.logger.error("Error handling TAP record event", err);
			}
		});

		// Handle identity events
		indexer.identity((evt: IdentityEvent) => {
			this.logger.debug(
				`${evt.did} updated identity: ${evt.handle} (${evt.status})`,
			);
			return Promise.resolve();
		});

		// Handle errors
		indexer.error((err: Error) => {
			this.logger.error("TAP indexer error", err);
		});

		// Create WebSocket channel
		this.channel = this.tap.channel(indexer);

		// Start the channel in the background (non-blocking)
		void this.channel
			.start()
			.then(() => {
				this.logger.log("TAP ingester connected and ready");
			})
			.catch((err) => {
				this.logger.error("Failed to start TAP channel", err);
			});
	}

	private async stopIngester() {
		if (this.channel) {
			await this.channel.destroy();
			this.channel = null;
		}
		this.tap = null;
		this.logger.log("TAP ingester stopped");
	}

	/**
	 * Register a user's DID with TAP to start tracking their repo.
	 * TAP will automatically backfill all historical records.
	 */
	async addRepo(did: string): Promise<void> {
		if (!this.tap) {
			throw new Error("TAP client not initialized");
		}

		try {
			await this.tap.addRepos([did]);
		} catch (err) {
			this.logger.error(`Failed to register repo ${did} with TAP`, err);
			throw err;
		}
	}

	/**
	 * Unregister a user's DID from TAP to stop tracking their repo.
	 */
	async removeRepo(did: string): Promise<void> {
		if (!this.tap) {
			throw new Error("TAP client not initialized");
		}

		await this.tap.removeRepos([did]);
	}

	/**
	 * Register all existing users with TAP on startup.
	 * This ensures we backfill any records created while the service was down.
	 */
	private async registerExistingUsers(): Promise<void> {
		try {
			const users = await this.prisma.user.findMany({
				select: { did: true },
			});

			if (users.length === 0) {
				return;
			}

			const dids = users.map((u) => u.did);

			// Register each user individually to handle partial failures
			for (const did of dids) {
				try {
					await this.addRepo(did);
				} catch (err) {
					this.logger.error(`Failed to register repo ${did} with TAP`, err);
					// Continue with next user even if one fails
				}
			}
		} catch (err) {
			this.logger.error("Failed to register existing users with TAP", err);
		}
	}

	private async handleRecordEvent(evt: RecordEvent) {
		const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`;

		if (evt.collection === MOVIE_COLLECTION) {
			await this.handleMovieEvent(evt, uri);
		} else if (evt.collection === EPISODE_COLLECTION) {
			await this.handleEpisodeEvent(evt, uri);
		} else if (evt.collection === PROFILE_COLLECTION) {
			await this.handleProfileEvent(evt, uri);
		} else if (evt.collection === FOLLOW_COLLECTION) {
			await this.handleFollowEvent(evt, uri);
		} else if (evt.collection === LIST_COLLECTION) {
			await this.handleListEvent(evt, uri);
		} else if (evt.collection === LIST_ITEM_COLLECTION) {
			await this.handleListItemEvent(evt, uri);
		} else if (evt.collection === NOTE_COLLECTION) {
			await this.handleNoteEvent(evt, uri);
		} else if (evt.collection === REVIEW_COLLECTION) {
			await this.handleReviewEvent(evt, uri);
		} else if (evt.collection === REVIEW_LIKE_COLLECTION) {
			await this.handleReviewLikeEvent(evt, uri);
		}
	}

	private async handleFollowEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let followRecord: FollowRecord;
			try {
				followRecord = followSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			await this.socialService.indexFollowRecord(
				evt.did,
				evt.rkey,
				evt.cid,
				followRecord,
				uri,
			);
		} else if (evt.action === "delete") {
			await this.socialService.deleteFollowRecordIndex(evt.did, evt.rkey);
		}
	}

	private async handleMovieEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let movieRecord: MovieRecord;
			try {
				movieRecord = movieSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			const existingMovie = await this.moviesService.getMovieByTMDBId(
				movieRecord.movieId,
			);
			if (!existingMovie) {
				try {
					const movieData = await this.moviesService.getMovieDetails(
						movieRecord.movieId,
					);
					await this.moviesService.upsertMovie(movieData);
				} catch (err) {
					this.logger.error(
						`Failed to fetch movie ${movieRecord.movieId} from TMDB, skipping record`,
						err,
					);
					return;
				}
			}

			await this.prisma.trackedMovie.upsert({
				where: { rkey: evt.rkey },
				create: {
					uri,
					rkey: evt.rkey,
					cid: evt.cid ?? "",
					userDid: evt.did,
					movieId: movieRecord.movieId,
					watchedDate: new Date(movieRecord.watchedAt),
					status: "watched",
				},
				update: {
					cid: evt.cid ?? "",
					watchedDate: new Date(movieRecord.watchedAt),
					status: "watched",
				},
			});
		}

		if (evt.action === "delete") {
			await this.prisma.trackedMovie.deleteMany({
				where: { rkey: evt.rkey },
			});
		}
	}

	private async handleProfileEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let profileRecord: ProfileRecord;
			try {
				profileRecord = profileSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			await this.profileService.indexProfileRecord(
				evt.did,
				evt.rkey,
				evt.cid ?? null,
				uri,
				profileRecord,
			);
		}

		if (evt.action === "delete") {
			await this.profileService.deleteProfileRecordIndex(evt.did);
		}
	}

	private async handleListEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let listRecord: ListRecord;
			try {
				listRecord = listSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			await this.listsService.indexListRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				listRecord,
			);
		}

		if (evt.action === "delete") {
			await this.listsService.deleteListRecord(evt.rkey);
		}
	}

	private async handleEpisodeEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let episodeRecord: EpisodeRecord;
			try {
				episodeRecord = episodeSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			const existingShow = await this.showsService.getShowByTMDBId(
				episodeRecord.showId,
			);
			if (!existingShow) {
				try {
					const showData = await this.showsService.getShowDetails(
						episodeRecord.showId,
					);
					await this.showsService.upsertShow(showData);
				} catch (err) {
					this.logger.error(
						`Failed to fetch show ${episodeRecord.showId} from TMDB, skipping record`,
						err,
					);
					return;
				}
			}
			await this.showsService
				.syncShowMetadata(episodeRecord.showId)
				.catch((err) =>
					this.logger.warn(
						`Failed to sync metadata for show ${episodeRecord.showId}: ${err instanceof Error ? err.message : String(err)}`,
					),
				);

			await this.prisma.trackedEpisode.upsert({
				where: { rkey: evt.rkey },
				create: {
					uri,
					rkey: evt.rkey,
					cid: evt.cid ?? "",
					userDid: evt.did,
					showId: episodeRecord.showId,
					seasonNumber: episodeRecord.seasonNumber,
					episodeNumber: episodeRecord.episodeNumber,
					watchedDate: new Date(episodeRecord.watchedAt),
					status: "watched",
				},
				update: {
					cid: evt.cid ?? "",
					seasonNumber: episodeRecord.seasonNumber,
					episodeNumber: episodeRecord.episodeNumber,
					watchedDate: new Date(episodeRecord.watchedAt),
					status: "watched",
				},
			});
		}

		if (evt.action === "delete") {
			await this.prisma.trackedEpisode.deleteMany({
				where: { rkey: evt.rkey },
			});
		}
	}

	private async handleListItemEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let listItemRecord: ListItemRecord;
			try {
				listItemRecord = listItemSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			await this.listsService.indexListItemRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				listItemRecord,
			);
		}

		if (evt.action === "delete") {
			await this.listsService.deleteListItemRecord(evt.rkey);
		}
	}

	private async handleNoteEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let noteRecord: NoteRecord;
			try {
				noteRecord = noteSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			await this.notesService.indexNoteRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				noteRecord,
			);
		}

		if (evt.action === "delete") {
			await this.notesService.deleteNoteRecord(evt.rkey);
		}
	}

	private async handleReviewEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let reviewRecord: ReviewRecord;
			try {
				reviewRecord = reviewSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			await this.reviewsService.indexReviewRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				reviewRecord,
			);
		}

		if (evt.action === "delete") {
			await this.reviewsService.deleteReviewRecord(evt.rkey);
		}
	}

	private async handleReviewLikeEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let reviewLikeRecord: ReviewLikeRecord;
			try {
				reviewLikeRecord = reviewLikeSchema.parse(evt.record);
			} catch {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				return;
			}

			await this.reviewsService.indexReviewLikeRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				reviewLikeRecord,
			);
		}

		if (evt.action === "delete") {
			await this.reviewsService.deleteReviewLikeRecord(evt.rkey);
		}
	}
}
