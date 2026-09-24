import {
	Global,
	Inject,
	Injectable,
	Logger,
	Module,
	type OnModuleDestroy,
	Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
	MemoryTmdbCacheStore,
	RedisTmdbCacheStore,
	type TmdbCacheStore,
} from "./tmdb-cache.store";

/** Injection token for the process-wide {@link TmdbCacheStore}. */
export const TMDB_CACHE_STORE = Symbol("TMDB_CACHE_STORE");
/** Injection token for the ioredis connection, present only when `REDIS_URL` is set. */
export const TMDB_REDIS_CLIENT = Symbol("TMDB_REDIS_CLIENT");

/**
 * Builds the one Redis connection the TMDB cache uses. `null` when `REDIS_URL`
 * is unset, which is the local default and what Staging runs with until the
 * operator adds the service.
 *
 * The connection is tuned to fail fast rather than queue: with the offline
 * queue disabled a command issued while disconnected rejects immediately, and
 * the command timeout bounds a connected but silent Redis, so an outage costs
 * one rejected call per read instead of a hang. ioredis
 * keeps reconnecting in the background, and the store logs recovery.
 */
export function createTmdbRedisClient(
	config: ConfigService,
	logger: Logger,
): Redis | null {
	const url = config.get<string>("REDIS_URL");
	if (!url) {
		logger.log("REDIS_URL not set; TMDB cache is per-process memory");
		return null;
	}
	const client = new Redis(url, {
		lazyConnect: true,
		enableOfflineQueue: false,
		maxRetriesPerRequest: 0,
		connectTimeout: 5_000,
		// A cache read must never be slower than the TMDB call it replaces. A
		// connected but unresponsive Redis would otherwise hang every cached
		// read; a rejected command is a miss and the store falls through.
		commandTimeout: 1_000,
		// Reconnect with a capped backoff forever; the store degrades meanwhile.
		retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
	});
	// Without a listener ioredis emits errors as unhandled events on connect
	// failures. The store already reports the outage once, so log at debug.
	client.on("error", (error: Error) => {
		logger.debug(`Redis connection error: ${error.message}`);
	});
	client.connect().catch(() => {
		// Reported through the "error" listener and the store's first miss.
	});
	logger.log("TMDB cache backed by Redis");
	return client;
}

@Injectable()
class TmdbRedisLifecycle implements OnModuleDestroy {
	constructor(
		@Optional()
		@Inject(TMDB_REDIS_CLIENT)
		private readonly client: Redis | null,
	) {}

	async onModuleDestroy(): Promise<void> {
		if (!this.client) return;
		try {
			await this.client.quit();
		} catch {
			this.client.disconnect();
		}
	}
}

/**
 * Provides the shared TMDB cache store (ADR 0041). Global so the four TMDB
 * services can inject it without each module importing this one.
 */
@Global()
@Module({
	providers: [
		{
			provide: TMDB_REDIS_CLIENT,
			useFactory: (config: ConfigService) =>
				createTmdbRedisClient(config, new Logger(TmdbCacheModule.name)),
			inject: [ConfigService],
		},
		{
			provide: TMDB_CACHE_STORE,
			useFactory: (client: Redis | null): TmdbCacheStore =>
				client ? new RedisTmdbCacheStore(client) : new MemoryTmdbCacheStore(),
			inject: [TMDB_REDIS_CLIENT],
		},
		TmdbRedisLifecycle,
	],
	exports: [TMDB_CACHE_STORE],
})
export class TmdbCacheModule {}
