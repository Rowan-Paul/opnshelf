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
import { Prisma } from "../generated/client";
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
	$nsid as RATING_COLLECTION,
	main as ratingSchema,
} from "../lexicons/xyz/opnshelf/rating";
import type { Main as RatingRecord } from "../lexicons/xyz/opnshelf/rating.defs";
import { RatingsService } from "../ratings/ratings.service";
import {
	$nsid as DOCUMENT_COLLECTION,
	main as documentSchema,
} from "../lexicons/site/standard/document";
import type { Main as DocumentRecord } from "../lexicons/site/standard/document.defs";
import {
	$nsid as PUBLICATION_COLLECTION,
	main as publicationSchema,
} from "../lexicons/site/standard/publication";
import type { Main as PublicationRecord } from "../lexicons/site/standard/publication.defs";
import {
	$nsid as REVIEW_LIKE_COLLECTION,
	main as reviewLikeSchema,
} from "../lexicons/xyz/opnshelf/review/like";
import type { Main as ReviewLikeRecord } from "../lexicons/xyz/opnshelf/review/like.defs";
import { ReviewsService } from "../reviews/reviews.service";
import { SocialService } from "../social/social.service";
import { ShowsService } from "../shows/shows.service";
import { ProfileService } from "../users/profile.service";

/**
 * Prisma error codes that indicate a transient/infrastructure failure rather
 * than a problem with the record itself. These are worth retrying and, if the
 * retry budget is exhausted, worth NOT acking so TAP redelivers the event.
 *  - P1000: authentication failed against the database
 *  - P1001: can't reach the database server
 *  - P1002: database connection timed out
 *  - P1008: operation timed out
 *  - P1011: error opening a TLS connection
 *  - P1017: server closed the connection
 *  - P2024: timed out fetching a connection from the pool
 *  - P2028: transaction API error
 *  - P2034: write conflict / deadlock — safe to retry
 */
const TRANSIENT_PRISMA_CODES = new Set([
	"P1000",
	"P1001",
	"P1002",
	"P1008",
	"P1011",
	"P1017",
	"P2024",
	"P2028",
	"P2034",
]);

/**
 * Classify an error thrown while indexing a record as transient (worth a retry
 * / redelivery) or permanent (the record will never index — drop it).
 *
 * Conservative by design: only errors we positively recognise as
 * infrastructure failures are treated as transient. Everything else (including
 * programming errors and validation failures) is permanent so we don't loop
 * forever redelivering a record that can never succeed.
 */
function isTransientError(err: unknown): boolean {
	if (err instanceof Prisma.PrismaClientKnownRequestError) {
		return TRANSIENT_PRISMA_CODES.has(err.code);
	}
	// Connection setup failures, engine panics and "unknown request" errors are
	// all infrastructure-level and not caused by the record contents.
	if (
		err instanceof Prisma.PrismaClientInitializationError ||
		err instanceof Prisma.PrismaClientRustPanicError ||
		err instanceof Prisma.PrismaClientUnknownRequestError
	) {
		return true;
	}
	// Generic network/timeout signatures (e.g. PDS/TMDB fetch failures that have
	// already exhausted their own retries, or a raw socket error).
	if (err instanceof Error) {
		const code = (err as NodeJS.ErrnoException).code;
		if (
			code === "ECONNRESET" ||
			code === "ECONNREFUSED" ||
			code === "ETIMEDOUT" ||
			code === "EPIPE" ||
			code === "ENOTFOUND" ||
			err.name === "AbortError" ||
			err.name === "TimeoutError"
		) {
			return true;
		}
	}
	return false;
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class IngesterService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(IngesterService.name);
	/** Max attempts (including the first) for a transient indexing failure. */
	private static readonly MAX_INDEX_ATTEMPTS = 3;
	/** Base backoff between retry attempts; doubled each attempt (200, 400...). */
	private static readonly INDEX_BACKOFF_BASE_MS = 200;
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
		private readonly ratingsService: RatingsService,
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

		// Handle record events (create, update, delete).
		//
		// Durability contract with TAP: SimpleIndexer acks an event only after
		// this handler resolves. If the handler throws, TapChannel does NOT ack
		// and TAP will redeliver the event later. We exploit that here:
		//  - Transient/infra failures (DB down, timeouts) are retried a few times
		//    in-handler; if still failing we RETHROW so the event is not acked and
		//    TAP redelivers it — the backfill guarantee is preserved.
		//  - Permanent failures (malformed record, record for another app, unknown
		//    user) are swallowed inside the per-collection handlers (logged at
		//    debug) so we ack and move on instead of looping forever.
		// Either way the channel loop stays alive.
		indexer.record(async (evt: RecordEvent) => {
			await this.processRecordEventWithRetry(evt);
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

	/**
	 * Dispatch a record event with a bounded retry for transient failures.
	 *
	 * On a transient error we retry up to {@link MAX_INDEX_ATTEMPTS} times with a
	 * small exponential backoff. If every attempt fails we RETHROW so TAP does
	 * not receive an ack and will redeliver the event (no silent data loss).
	 *
	 * On a permanent error we log at ERROR with full context and swallow it: the
	 * record can never index, so we ack and move on rather than wedge the loop.
	 * (Most "skips" — other apps' records, unknown users — never reach here as
	 * errors; the per-collection handlers return early and log at debug.)
	 */
	private async processRecordEventWithRetry(evt: RecordEvent): Promise<void> {
		const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`;

		for (
			let attempt = 1;
			attempt <= IngesterService.MAX_INDEX_ATTEMPTS;
			attempt++
		) {
			try {
				await this.handleRecordEvent(evt);
				return;
			} catch (err) {
				if (!isTransientError(err)) {
					// Permanent: record will never index. Drop it (ack) but make it
					// diagnosable.
					this.logger.error(
						`Dropping record after permanent indexing error (collection=${evt.collection} did=${evt.did} rkey=${evt.rkey} action=${evt.action})`,
						err instanceof Error ? err.stack : String(err),
					);
					return;
				}

				if (attempt < IngesterService.MAX_INDEX_ATTEMPTS) {
					const backoff =
						IngesterService.INDEX_BACKOFF_BASE_MS * 2 ** (attempt - 1);
					this.logger.warn(
						`Transient indexing error for ${uri} (attempt ${attempt}/${IngesterService.MAX_INDEX_ATTEMPTS}); retrying in ${backoff}ms: ${err instanceof Error ? err.message : String(err)}`,
					);
					await sleep(backoff);
					continue;
				}

				// Retry budget exhausted on a transient failure. Rethrow so TAP does
				// NOT ack and will redeliver the event — this is what keeps the
				// "index records created while down" guarantee alive across a DB blip.
				this.logger.error(
					`Transient indexing error persisted after ${IngesterService.MAX_INDEX_ATTEMPTS} attempts for ${uri}; not acking so TAP can redeliver`,
					err instanceof Error ? err.stack : String(err),
				);
				throw err;
			}
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
		} else if (evt.collection === DOCUMENT_COLLECTION) {
			await this.handleDocumentEvent(evt, uri);
		} else if (evt.collection === PUBLICATION_COLLECTION) {
			await this.handlePublicationEvent(evt, uri);
		} else if (evt.collection === RATING_COLLECTION) {
			await this.handleRatingEvent(evt, uri);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${FOLLOW_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${MOVIE_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${PROFILE_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${LIST_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${EPISODE_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${LIST_ITEM_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${NOTE_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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

	private async handleDocumentEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let documentRecord: DocumentRecord;
			try {
				documentRecord = documentSchema.parse(evt.record);
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${DOCUMENT_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			// Only treat documents authored by a tracked user as candidate
			// reviews. The service further requires an xyz.opnshelf.mediaLink
			// member before indexing — arbitrary standard.site blog posts are
			// ignored.
			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
				return;
			}

			await this.reviewsService.indexDocumentRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				documentRecord,
			);
		}

		if (evt.action === "delete") {
			await this.reviewsService.deleteDocumentRecord(evt.rkey);
		}
	}

	private async handlePublicationEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let publicationRecord: PublicationRecord;
			try {
				publicationRecord = publicationSchema.parse(evt.record);
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${PUBLICATION_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
				return;
			}

			await this.reviewsService.indexPublicationRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				publicationRecord,
			);
		}

		if (evt.action === "delete") {
			await this.reviewsService.deletePublicationRecord(evt.rkey);
		}
	}

	private async handleRatingEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let ratingRecord: RatingRecord;
			try {
				ratingRecord = ratingSchema.parse(evt.record);
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${RATING_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
				return;
			}

			await this.ratingsService.indexRatingRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				ratingRecord,
			);
		}

		if (evt.action === "delete") {
			await this.ratingsService.deleteRatingRecord(evt.rkey);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${REVIEW_LIKE_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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
