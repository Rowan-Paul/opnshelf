import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Tap, SimpleIndexer, RecordEvent, IdentityEvent } from '@atproto/tap';
import { PrismaService } from '../prisma/prisma.service';
import { MoviesService } from '../movies/movies.service';
import {
  main as movieSchema,
  $nsid as COLLECTION,
} from '../lexicons/app/opnshelf/movie';
import type { Main as MovieRecord } from '../lexicons/app/opnshelf/movie.defs';

@Injectable()
export class IngesterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngesterService.name);
  private tap: Tap | null = null;
  private channel: ReturnType<Tap['channel']> | null = null;
  private readonly tapUrl: string;
  private readonly tapAdminPassword: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly moviesService: MoviesService,
  ) {
    this.tapUrl =
      this.config.get<string>('TAP_URL') ?? 'http://localhost:2480';
    this.tapAdminPassword = this.config.get<string>('TAP_ADMIN_PASSWORD');
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
      this.logger.error('TAP init failed; continuing without ingester', e);
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
        this.logger.error('Error handling TAP record event', err);
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
      this.logger.error('TAP indexer error', err);
    });

    // Create WebSocket channel
    this.channel = this.tap.channel(indexer);

    // Start the channel in the background (non-blocking)
    void this.channel
      .start()
      .then(() => {
        this.logger.log('TAP ingester connected and ready');
      })
      .catch((err) => {
        this.logger.error('Failed to start TAP channel', err);
      });
  }

  private async stopIngester() {
    if (this.channel) {
      await this.channel.destroy();
      this.channel = null;
    }
    this.tap = null;
    this.logger.log('TAP ingester stopped');
  }

  /**
   * Register a user's DID with TAP to start tracking their repo.
   * TAP will automatically backfill all historical records.
   */
  async addRepo(did: string): Promise<void> {
    if (!this.tap) {
      throw new Error('TAP client not initialized');
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
      throw new Error('TAP client not initialized');
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
        this.logger.log('No existing users to register with TAP');
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
      this.logger.error('Failed to register existing users with TAP', err);
    }
  }

  private async handleRecordEvent(evt: RecordEvent) {
    this.logger.debug(
      `Received TAP event: ${evt.action} ${evt.collection} for ${evt.did} (live: ${evt.live})`,
    );

    // Only process events for our collection
    if (evt.collection !== COLLECTION) {
      this.logger.debug(`Skipping event for collection ${evt.collection}`);
      return;
    }

    const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`;

    // Handle create and update events
    if (evt.action === 'create' || evt.action === 'update') {
      if (!evt.record) {
        this.logger.warn(`Record event missing record data: ${uri}`);
        return;
      }

      // Validate the record using the generated schema
      let movieRecord: MovieRecord;
      try {
        movieRecord = movieSchema.parse(evt.record);
      } catch {
        this.logger.debug('Received invalid movie record, skipping');
        return;
      }

      // Only index records for users who exist in our database
      const user = await this.prisma.user.findUnique({
        where: { did: evt.did },
      });

      if (!user) {
        this.logger.debug(`User ${evt.did} not in database, skipping record`);
        return;
      }

      this.logger.log(
        `Indexing movie record (${evt.live ? 'live' : 'backfill'}): ${uri}`,
      );

      // Ensure movie exists in database before creating tracked movie
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

      // Create or update TrackedMovie in database (rkey is unique)
      await this.prisma.trackedMovie.upsert({
        where: { rkey: evt.rkey },
        create: {
          uri,
          rkey: evt.rkey,
          cid: evt.cid ?? '',
          userDid: evt.did,
          movieId: movieRecord.movieId,
          watchedDate: new Date(movieRecord.watchedAt),
          status: 'watched',
        },
        update: {
          cid: evt.cid ?? '',
          watchedDate: new Date(movieRecord.watchedAt),
          status: 'watched',
        },
      });

      this.logger.debug(
        `Indexed movie ${movieRecord.movieId} for user ${evt.did}`,
      );
    }

    // Handle delete events
    if (evt.action === 'delete') {
      this.logger.log(`Removing movie record: ${uri} (rkey: ${evt.rkey})`);

      await this.prisma.trackedMovie.deleteMany({
        where: { rkey: evt.rkey },
      });

      this.logger.debug(`Removed record with rkey ${evt.rkey}`);
    }
  }
}
