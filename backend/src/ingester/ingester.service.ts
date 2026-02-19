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
	$nsid as LIST_COLLECTION,
	main as listSchema,
} from "../lexicons/app/opnshelf/list";
import type { Main as ListRecord } from "../lexicons/app/opnshelf/list.defs";
import {
	$nsid as LIST_ITEM_COLLECTION,
	main as listItemSchema,
} from "../lexicons/app/opnshelf/listItem";
import type { Main as ListItemRecord } from "../lexicons/app/opnshelf/listItem.defs";
import {
	$nsid as EPISODE_COLLECTION,
	main as episodeSchema,
} from "../lexicons/app/opnshelf/episode";
import type { Main as EpisodeRecord } from "../lexicons/app/opnshelf/episode.defs";
import {
	$nsid as MOVIE_COLLECTION,
	main as movieSchema,
} from "../lexicons/app/opnshelf/movie";
import type { Main as MovieRecord } from "../lexicons/app/opnshelf/movie.defs";
import { ListsService } from "../lists/lists.service";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";

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

		this.logger.log(`Registering repo with TAP: ${did}`);
		try {
			await this.tap.addRepos([did]);
			this.logger.log(`Successfully registered repo: ${did}`);

			// Check repo info to verify it's being tracked
			try {
				const repoInfo = await this.tap.getRepoInfo(did);
				this.logger.debug(
					`Repo ${did} info: state=${repoInfo.state}, rev=${repoInfo.rev}, records=${repoInfo.records}`,
				);
			} catch (infoErr) {
				this.logger.warn(`Could not get repo info for ${did}`, infoErr);
			}
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

		this.logger.log(`Unregistering repo from TAP: ${did}`);
		await this.tap.removeRepos([did]);
		this.logger.debug(`Successfully unregistered repo: ${did}`);
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
				this.logger.log("No existing users to register with TAP");
				return;
			}

			const dids = users.map((u) => u.did);
			this.logger.log(`Registering ${dids.length} existing users with TAP`);

			// Register each user individually to handle partial failures
			let successCount = 0;
			for (const did of dids) {
				try {
					await this.addRepo(did);
					successCount++;
				} catch (err) {
					this.logger.error(`Failed to register repo ${did} with TAP`, err);
					// Continue with next user even if one fails
				}
			}

			this.logger.log(
				`Successfully registered ${successCount}/${dids.length} repos with TAP`,
			);
		} catch (err) {
			this.logger.error("Failed to register existing users with TAP", err);
		}
	}

	private async handleRecordEvent(evt: RecordEvent) {
		this.logger.debug(
			`Received TAP event: ${evt.action} ${evt.collection} for ${evt.did} (live: ${evt.live})`,
		);

		const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`;

		if (evt.collection === MOVIE_COLLECTION) {
			await this.handleMovieEvent(evt, uri);
		} else if (evt.collection === EPISODE_COLLECTION) {
			await this.handleEpisodeEvent(evt, uri);
		} else if (evt.collection === LIST_COLLECTION) {
			await this.handleListEvent(evt, uri);
		} else if (evt.collection === LIST_ITEM_COLLECTION) {
			await this.handleListItemEvent(evt, uri);
		} else {
			this.logger.debug(`Skipping event for collection ${evt.collection}`);
		}
	}

	private async handleMovieEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.warn(`Record event missing record data: ${uri}`);
				return;
			}

			let movieRecord: MovieRecord;
			try {
				movieRecord = movieSchema.parse(evt.record);
			} catch {
				this.logger.debug("Received invalid movie record, skipping");
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`User ${evt.did} not in database, skipping record`);
				return;
			}

			this.logger.log(
				`Indexing movie record (${evt.live ? "live" : "backfill"}): ${uri}`,
			);

			const existingMovie = await this.moviesService.getMovieByTMDBId(
				movieRecord.movieId,
			);
			if (!existingMovie) {
				try {
					const movieData = await this.moviesService.getMovieDetails(
						movieRecord.movieId,
					);
					await this.moviesService.upsertMovie(movieData);
					this.logger.debug(`Created movie ${movieRecord.movieId} from TMDB`);
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

			this.logger.debug(
				`Indexed movie ${movieRecord.movieId} for user ${evt.did}`,
			);
		}

		if (evt.action === "delete") {
			this.logger.log(`Removing movie record: ${uri} (rkey: ${evt.rkey})`);

			await this.prisma.trackedMovie.deleteMany({
				where: { rkey: evt.rkey },
			});

			this.logger.debug(`Removed record with rkey ${evt.rkey}`);
		}
	}

	private async handleListEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.warn(`Record event missing record data: ${uri}`);
				return;
			}

			let listRecord: ListRecord;
			try {
				listRecord = listSchema.parse(evt.record);
			} catch {
				this.logger.debug("Received invalid list record, skipping");
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`User ${evt.did} not in database, skipping record`);
				return;
			}

			this.logger.log(
				`Indexing list record (${evt.live ? "live" : "backfill"}): ${uri}`,
			);

			await this.listsService.indexListRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				listRecord,
			);
		}

		if (evt.action === "delete") {
			this.logger.log(`Removing list record: ${uri} (rkey: ${evt.rkey})`);
			await this.listsService.deleteListRecord(evt.rkey);
		}
	}

	private async handleEpisodeEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.warn(`Record event missing record data: ${uri}`);
				return;
			}

			let episodeRecord: EpisodeRecord;
			try {
				episodeRecord = episodeSchema.parse(evt.record);
			} catch {
				this.logger.debug("Received invalid episode record, skipping");
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`User ${evt.did} not in database, skipping record`);
				return;
			}

			this.logger.log(
				`Indexing episode record (${evt.live ? "live" : "backfill"}): ${uri}`,
			);

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
			this.logger.log(`Removing episode record: ${uri} (rkey: ${evt.rkey})`);
			await this.prisma.trackedEpisode.deleteMany({
				where: { rkey: evt.rkey },
			});
		}
	}

	private async handleListItemEvent(evt: RecordEvent, uri: string) {
		if (evt.action === "create" || evt.action === "update") {
			if (!evt.record) {
				this.logger.warn(`Record event missing record data: ${uri}`);
				return;
			}

			let listItemRecord: ListItemRecord;
			try {
				listItemRecord = listItemSchema.parse(evt.record);
			} catch {
				this.logger.debug("Received invalid list item record, skipping");
				return;
			}

			const user = await this.prisma.user.findUnique({
				where: { did: evt.did },
			});

			if (!user) {
				this.logger.debug(`User ${evt.did} not in database, skipping record`);
				return;
			}

			this.logger.log(
				`Indexing list item record (${evt.live ? "live" : "backfill"}): ${uri}`,
			);

			await this.listsService.indexListItemRecord(
				uri,
				evt.cid ?? "",
				evt.rkey,
				evt.did,
				listItemRecord,
			);
		}

		if (evt.action === "delete") {
			this.logger.log(`Removing list item record: ${uri} (rkey: ${evt.rkey})`);
			await this.listsService.deleteListItemRecord(evt.rkey);
		}
	}
}
