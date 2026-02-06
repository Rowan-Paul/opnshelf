import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Firehose } from '@atproto/sync';
import { IdResolver } from '@atproto/identity';
import { PrismaService } from '../prisma/prisma.service';
import {
  main as movieSchema,
  $nsid as COLLECTION,
} from '../lexicons/app/opnshelf/movie';
import type { Main as MovieRecord } from '../lexicons/app/opnshelf/movie.defs';

interface FirehoseEvent {
  event: string;
  collection?: string;
  record?: unknown;
  uri?: { toString(): string };
  rkey?: string;
  cid?: { toString(): string };
  author?: string;
}

@Injectable()
export class IngesterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngesterService.name);
  private firehose: Firehose | null = null;
  private readonly relayUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Default to Bluesky's public relay
    this.relayUrl =
      this.config.get<string>('ATPROTO_RELAY_URL') || 'wss://bsky.network';
  }

  onModuleInit() {
    void this.startIngester();
  }

  onModuleDestroy() {
    this.stopIngester();
  }

  private startIngester() {
    this.logger.log(
      `Starting firehose ingester, connecting to ${this.relayUrl}`,
    );

    // IdResolver is required to verify repo signatures on firehose events
    const idResolver = new IdResolver();

    this.firehose = new Firehose({
      idResolver,
      filterCollections: [COLLECTION],
      handleEvent: async (evt: FirehoseEvent) => {
        try {
          await this.handleEvent(evt);
        } catch (err) {
          this.logger.error('Error handling firehose event', err);
        }
      },
      onError: (err: { message: string }) => {
        // Log non-fatal errors (e.g., parse errors for events we don't handle)
        this.logger.warn('Firehose error (non-fatal)', err.message);
      },
    });

    // Start the firehose connection
    void this.firehose.start();
    this.logger.log('Firehose ingester started');
  }

  private stopIngester() {
    if (this.firehose) {
      void this.firehose.destroy();
      this.firehose = null;
      this.logger.log('Firehose ingester stopped');
    }
  }

  /**
   * Extract DID from AT URI (format: at://{did}/{collection}/{rkey})
   */
  private extractDidFromUri(uri: string): string | null {
    const match = uri.match(/^at:\/\/(did:[^/]+)\//);
    return match ? match[1] : null;
  }

  private async handleEvent(evt: FirehoseEvent) {
    // Handle create and update events
    if (evt.event === 'create' || evt.event === 'update') {
      if (evt.collection !== COLLECTION) return;

      const record = evt.record;

      // Validate the record using the generated schema
      let movieRecord: MovieRecord;
      try {
        movieRecord = movieSchema.parse(record);
      } catch {
        this.logger.debug('Received invalid movie record, skipping');
        return;
      }

      const uri = evt.uri?.toString() ?? '';
      const rkey = evt.rkey ?? '';
      const cid = evt.cid?.toString() ?? '';

      // Extract author DID from event or URI
      const authorDid = evt.author || this.extractDidFromUri(uri);
      if (!authorDid) {
        this.logger.warn(`Could not determine author DID for ${uri}, skipping`);
        return;
      }

      // Only index records for users who exist in our database
      // (i.e., users who have logged in to OpnShelf)
      const user = await this.prisma.user.findUnique({
        where: { did: authorDid },
      });

      if (!user) {
        this.logger.debug(`User ${authorDid} not in database, skipping record`);
        return;
      }

      this.logger.log(`Indexing movie record: ${uri}`);

      // Upsert TrackedMovie in database
      await this.prisma.trackedMovie.upsert({
        where: { uri },
        create: {
          uri,
          rkey,
          cid,
          userDid: authorDid,
          movieId: movieRecord.movieId,
          watchedDate: new Date(movieRecord.watchedAt),
          status: 'watched',
        },
        update: {
          cid,
          watchedDate: new Date(movieRecord.watchedAt),
          status: 'watched',
        },
      });

      this.logger.debug(
        `Indexed movie ${movieRecord.movieId} for user ${authorDid}`,
      );
    }

    // Handle delete events
    if (evt.event === 'delete') {
      if (evt.collection !== COLLECTION) return;

      const uri = evt.uri?.toString();
      if (!uri) {
        this.logger.warn('Delete event missing URI, skipping');
        return;
      }
      this.logger.log(`Removing movie record: ${uri}`);

      await this.prisma.trackedMovie.deleteMany({
        where: { uri },
      });

      this.logger.debug(`Removed record ${uri}`);
    }
  }
}
