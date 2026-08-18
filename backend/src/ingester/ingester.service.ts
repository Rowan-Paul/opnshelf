import {
	type IdentityEvent,
	type RecordEvent,
	SimpleIndexer,
	Tap,
} from "@atproto/tap";
import {
	Injectable,
	Logger,
	NotFoundException,
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
	$nsid as LIBRARY_ITEM_COLLECTION,
	main as libraryItemSchema,
} from "../lexicons/xyz/opnshelf/library/item";
import type { Main as LibraryItemRecord } from "../lexicons/xyz/opnshelf/library/item.defs";
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
import { LibraryService } from "../library/library.service";
import { ListsService } from "../lists/lists.service";
import { MoviesService } from "../movies/movies.service";
import {
	$nsid as NOTE_COLLECTION,
	main as noteSchema,
} from "../lexicons/xyz/opnshelf/note";
import type { Main as NoteRecord } from "../lexicons/xyz/opnshelf/note.defs";
import { NotesService } from "../notes/notes.service";
import { PrismaService } from "../prisma/prisma.service";
import { TmdbServiceError } from "../tmdb/tmdb-http";
import {
	$nsid as RATING_COLLECTION,
	main as ratingSchema,
} from "../lexicons/xyz/opnshelf/rating";
import type { Main as RatingRecord } from "../lexicons/xyz/opnshelf/rating.defs";
import { RatingsService } from "../ratings/ratings.service";
import {
	$nsid as REVIEW_COLLECTION,
	main as reviewSchema,
} from "../lexicons/xyz/opnshelf/review";
import type { Main as ReviewRecord } from "../lexicons/xyz/opnshelf/review.defs";
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
import { UsersService } from "../users/users.service";

/**
 * Prisma error codes that indicate a transient/infrastructure failure rather
 * than a problem with the record itself. These are worth retrying and, if the
 * retry budget is exhausted, worth NOT acking so Tab redelivers the event.
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
	// A TMDB outage (5xx after retries, timeout, network) during indexing is an
	// upstream failure, not a problem with the record — retry / redeliver. A
	// genuine 404 surfaces as TmdbNotFoundError (NOT matched here) and stays
	// permanent so we never loop forever on an invalid TMDB id.
	if (err instanceof TmdbServiceError) {
		return true;
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
	private tab: Tap | null = null;
	private channel: ReturnType<Tap["channel"]> | null = null;
	private readonly tabUrl: string;
	private readonly tabAdminPassword: string | undefined;
	/**
	 * In-memory set of DIDs we know are tracked, used as a fast-path before the
	 * per-event `user.findUnique` (which otherwise runs on every firehose event).
	 *
	 * Safe because Tab only delivers events for repos we explicitly addRepo'd,
	 * and every addRepo is preceded by persisting the user. We populate this set
	 * at exactly those points (addRepo, registerExistingUsers). It is purely a
	 * positive cache: a HIT skips the DB; a MISS falls back to the DB lookup and
	 * populates the set on success — so a newly-registered user whose entry is
	 * somehow absent is still checked against the DB and never wrongly skipped.
	 */
	private readonly trackedDids = new Set<string>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
		private readonly moviesService: MoviesService,
		private readonly showsService: ShowsService,
		private readonly listsService: ListsService,
		private readonly libraryService: LibraryService,
		private readonly notesService: NotesService,
		private readonly reviewsService: ReviewsService,
		private readonly ratingsService: RatingsService,
		private readonly socialService: SocialService,
		private readonly profileService: ProfileService,
		private readonly usersService: UsersService,
	) {
		this.tabUrl =
			this.config.get<string>("TAB_URL") ??
			this.config.get<string>("TAP_URL") ??
			"http://localhost:2480";
		this.tabAdminPassword =
			this.config.get<string>("TAB_ADMIN_PASSWORD") ??
			this.config.get<string>("TAP_ADMIN_PASSWORD");
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
			this.logger.error("Tab init failed; continuing without ingester", e);
		}
	}

	async onModuleDestroy() {
		await this.stopIngester();
	}

	private startIngester(): void {
		this.logger.log(`Starting Tab ingester, connecting to ${this.tabUrl}`);

		// Tab implements TAP's API, so the upstream TAP client remains compatible.
		this.tab = new Tap(this.tabUrl, {
			adminPassword: this.tabAdminPassword,
		});

		// Create indexer to handle events
		const indexer = new SimpleIndexer();

		// Handle record events (create, update, delete).
		//
		// Durability contract with Tab: SimpleIndexer acks an event only after
		// this handler resolves. If the handler throws, TapChannel does NOT ack
		// and Tab will redeliver the event later. We exploit that here:
		//  - Transient/infra failures (DB down, timeouts) are retried a few times
		//    in-handler; if still failing we RETHROW so the event is not acked and
		//    Tab redelivers it — the backfill guarantee is preserved.
		//  - Permanent failures (malformed record, record for another app, unknown
		//    user) are swallowed inside the per-collection handlers (logged at
		//    debug) so we ack and move on instead of looping forever.
		// Either way the channel loop stays alive.
		indexer.record(async (evt: RecordEvent) => {
			await this.processRecordEventWithRetry(evt);
		});

		// Handle identity events
		indexer.identity(async (evt: IdentityEvent) => {
			this.logger.debug(
				`${evt.did} updated identity: ${evt.handle} (${evt.status})`,
			);

			if (evt.status !== "deleted") {
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
				select: { did: true },
			});

			if (user) {
				try {
					await this.usersService.deleteUserSync(evt.did);
				} catch (error) {
					// Another delivery may have removed the user after our lookup.
					// Treat that race as an idempotent success; retry every other error.
					if (!(error instanceof NotFoundException)) {
						throw error;
					}
				}
			}

			// Delete local state before untracking. If either step fails, rejecting
			// leaves the event unacknowledged so Tab can redeliver it.
			await this.removeRepo(evt.did);
			this.logger.log(`Removed deleted account ${evt.did} from local storage`);
		});

		// Handle errors
		indexer.error((err: Error) => {
			this.logger.error("Tab indexer error", err);
		});

		// Create WebSocket channel
		this.channel = this.tab.channel(indexer);

		// Start the channel in the background (non-blocking)
		void this.channel
			.start()
			.then(() => {
				this.logger.log("Tab ingester connected and ready");
			})
			.catch((err) => {
				this.logger.error("Failed to start Tab channel", err);
			});
	}

	private async stopIngester() {
		if (this.channel) {
			await this.channel.destroy();
			this.channel = null;
		}
		this.tab = null;
		this.logger.log("Tab ingester stopped");
	}

	/**
	 * Register a user's DID with Tab to start tracking their repo.
	 * Tab will automatically backfill all historical records.
	 *
	 * Pass `markBackfillStart: true` from the auth flow (sign-in / sign-up) to
	 * stamp `User.backfillStartedAt`, which opens the "syncing your watch
	 * history…" window the shelf reads. The startup re-register sweep
	 * (`registerExistingUsers`) MUST leave it unset, otherwise every existing
	 * user would appear to be syncing after a deploy.
	 */
	async addRepo(
		did: string,
		opts: { markBackfillStart?: boolean } = {},
	): Promise<void> {
		if (!this.tab) {
			throw new Error("Tab client not initialized");
		}

		try {
			await this.tab.addRepos([did]);
			// Mark tracked only after Tab accepts the repo, so a failed add doesn't
			// leave a stale positive entry. (A missing entry is harmless — the
			// handlers fall back to the DB.)
			this.trackedDids.add(did);
		} catch (err) {
			this.logger.error(`Failed to register repo ${did} with Tab`, err);
			throw err;
		}

		if (opts.markBackfillStart) {
			// Best-effort: the repo is already registered, so a failure to stamp
			// only costs us the sync indicator — never block sign-in on it.
			try {
				await this.prisma.user.update({
					where: { did },
					data: { backfillStartedAt: new Date() },
				});
			} catch (err) {
				this.logger.warn(
					`Failed to stamp backfillStartedAt for ${did}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
	}

	/**
	 * Bump `User.lastIngestAt` to mark that a watch record just landed for this
	 * repo. The shelf uses the gap since this timestamp to decide when a backfill
	 * has gone quiet (i.e. caught up). Best-effort: the record is already
	 * persisted, so a failed bump only costs us indicator precision and must
	 * never fail the event (which would trigger a needless redelivery).
	 */
	private async touchLastIngest(did: string): Promise<void> {
		try {
			await this.prisma.user.update({
				where: { did },
				data: { lastIngestAt: new Date() },
			});
		} catch (err) {
			this.logger.debug(
				`Failed to bump lastIngestAt for ${did}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	/**
	 * Unregister a user's DID from Tab to stop tracking their repo.
	 */
	async removeRepo(did: string): Promise<void> {
		if (!this.tab) {
			throw new Error("Tab client not initialized");
		}

		await this.tab.removeRepos([did]);
		this.trackedDids.delete(did);
	}

	/**
	 * Register all existing users with Tab on startup.
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
					this.logger.error(`Failed to register repo ${did} with Tab`, err);
					// Continue with next user even if one fails
				}
			}
		} catch (err) {
			this.logger.error("Failed to register existing users with Tab", err);
		}
	}

	/**
	 * Fast-path check that the record's author is a tracked user.
	 *
	 * Cache HIT → no DB round-trip. Cache MISS → fall back to the per-event
	 * `user.findUnique` (the previous behaviour) and, if the user exists,
	 * populate the cache so subsequent events for that DID skip the DB. This
	 * keeps correctness for a brand-new user whose addRepo cache write hasn't
	 * happened yet (e.g. backfill racing signup, or an out-of-band repo add):
	 * we never skip a record for a user that is actually in the DB.
	 *
	 * Throws are propagated (a DB error here is classified by the caller as
	 * transient and triggers redelivery rather than a silent skip).
	 */
	private async isUserTracked(did: string): Promise<boolean> {
		if (this.trackedDids.has(did)) {
			return true;
		}
		const user = await this.prisma.user.findUnique({
			where: { did },
			select: { did: true },
		});
		if (user) {
			this.trackedDids.add(did);
			return true;
		}
		return false;
	}

	/**
	 * Dispatch a record event with a bounded retry for transient failures.
	 *
	 * On a transient error we retry up to {@link MAX_INDEX_ATTEMPTS} times with a
	 * small exponential backoff. If every attempt fails we RETHROW so Tab does
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

				// Retry budget exhausted on a transient failure. Rethrow so Tab does
				// NOT ack and will redeliver the event — this is what keeps the
				// "index records created while down" guarantee alive across a DB blip.
				this.logger.error(
					`Transient indexing error persisted after ${IngesterService.MAX_INDEX_ATTEMPTS} attempts for ${uri}; not acking so Tab can redeliver`,
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
		} else if (evt.collection === LIBRARY_ITEM_COLLECTION) {
			await this.handleLibraryItemEvent(evt, uri);
		} else if (evt.collection === NOTE_COLLECTION) {
			await this.handleNoteEvent(evt, uri);
		} else if (evt.collection === REVIEW_COLLECTION) {
			await this.handleReviewEvent(evt, uri);
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

			if (!(await this.isUserTracked(evt.did))) {
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

			if (!(await this.isUserTracked(evt.did))) {
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
					// A transient TMDB failure (5xx/timeout/network) is an upstream
					// outage, not a bad record — rethrow so processRecordEventWithRetry
					// retries and, if still failing, redelivers via Tab. A genuine
					// not-found (invalid movie id) is permanent: log and drop.
					if (isTransientError(err)) {
						throw err;
					}
					this.logger.error(
						`Failed to fetch movie ${movieRecord.movieId} from TMDB, skipping record`,
						err,
					);
					return;
				}
			}

			await this.prisma.trackedMovie.upsert({
				where: {
					userDid_rkey: { userDid: evt.did, rkey: evt.rkey },
				},
				create: {
					uri,
					rkey: evt.rkey,
					cid: evt.cid ?? "",
					userDid: evt.did,
					movieId: movieRecord.movieId,
					watchedDate: movieRecord.watchedAt
						? new Date(movieRecord.watchedAt)
						: null,
					status: "watched",
				},
				update: {
					cid: evt.cid ?? "",
					watchedDate: movieRecord.watchedAt
						? new Date(movieRecord.watchedAt)
						: null,
					status: "watched",
				},
			});

			await this.touchLastIngest(evt.did);
		}

		if (evt.action === "delete") {
			await this.prisma.trackedMovie.deleteMany({
				where: { userDid: evt.did, rkey: evt.rkey },
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

			if (!(await this.isUserTracked(evt.did))) {
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

			if (!(await this.isUserTracked(evt.did))) {
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
			await this.listsService.deleteListRecord(evt.did, evt.rkey);
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

			if (!(await this.isUserTracked(evt.did))) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
				return;
			}

			// Older PDS records may carry a composite id like "117648-5-3";
			// TMDB resolves it to the bare show id, which we use everywhere below.
			let showId = episodeRecord.showId;
			const existingShow = await this.showsService.getShowByTMDBId(showId);
			if (!existingShow) {
				try {
					const showData = await this.showsService.getShowDetails(showId);
					showId = showData.id.toString();
					await this.showsService.upsertShow(showData);
				} catch (err) {
					// Transient TMDB outage → rethrow for retry/redelivery; a genuine
					// not-found (invalid show id) is permanent → log and drop.
					if (isTransientError(err)) {
						throw err;
					}
					this.logger.error(
						`Failed to fetch show ${showId} from TMDB, skipping record`,
						err,
					);
					return;
				}
			}
			await this.showsService
				.syncShowMetadata(showId)
				.catch((err) =>
					this.logger.warn(
						`Failed to sync metadata for show ${showId}: ${err instanceof Error ? err.message : String(err)}`,
					),
				);

			await this.prisma.trackedEpisode.upsert({
				where: {
					userDid_rkey: { userDid: evt.did, rkey: evt.rkey },
				},
				create: {
					uri,
					rkey: evt.rkey,
					cid: evt.cid ?? "",
					userDid: evt.did,
					showId,
					seasonNumber: episodeRecord.seasonNumber,
					episodeNumber: episodeRecord.episodeNumber,
					watchedDate: episodeRecord.watchedAt
						? new Date(episodeRecord.watchedAt)
						: null,
					status: "watched",
				},
				update: {
					cid: evt.cid ?? "",
					seasonNumber: episodeRecord.seasonNumber,
					episodeNumber: episodeRecord.episodeNumber,
					watchedDate: episodeRecord.watchedAt
						? new Date(episodeRecord.watchedAt)
						: null,
					status: "watched",
				},
			});

			await this.touchLastIngest(evt.did);
		}

		if (evt.action === "delete") {
			await this.prisma.trackedEpisode.deleteMany({
				where: { userDid: evt.did, rkey: evt.rkey },
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

			if (!(await this.isUserTracked(evt.did))) {
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
			await this.listsService.deleteListItemRecord(evt.did, evt.rkey);
		}
	}

	private async handleLibraryItemEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.debug(`Record event missing record data: ${uri}`);
				return;
			}

			let libraryItemRecord: LibraryItemRecord;
			try {
				libraryItemRecord = libraryItemSchema.parse(evt.record);
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${LIBRARY_ITEM_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			if (!(await this.isUserTracked(evt.did))) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
				return;
			}

			await this.libraryService.indexLibraryItemRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				libraryItemRecord,
			);
		}

		if (evt.action === "delete") {
			await this.libraryService.deleteLibraryItemRecord(evt.did, evt.rkey);
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

			if (!(await this.isUserTracked(evt.did))) {
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
			await this.notesService.deleteNoteRecord(evt.did, evt.rkey);
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
			} catch (err) {
				this.logger.debug(
					`Skipping malformed ${REVIEW_COLLECTION} record ${uri}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return;
			}

			if (!(await this.isUserTracked(evt.did))) {
				this.logger.debug(`Skipping record for untracked user: ${uri}`);
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
			await this.reviewsService.deleteReviewRecord(evt.did, evt.rkey);
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

			if (!(await this.isUserTracked(evt.did))) {
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
			await this.reviewsService.deletePublicationRecord(evt.did, evt.rkey);
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

			if (!(await this.isUserTracked(evt.did))) {
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
			await this.ratingsService.deleteRatingRecord(evt.did, evt.rkey);
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

			if (!(await this.isUserTracked(evt.did))) {
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
			await this.reviewsService.deleteReviewLikeRecord(evt.did, evt.rkey);
		}
	}
}
