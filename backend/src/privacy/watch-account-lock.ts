import { createHash, randomUUID } from "node:crypto";
import {
	ConflictException,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { Pool } from "pg";
import { requestContext } from "../common/request-id";

export type WithAccountWrite = <T>(operation: () => Promise<T>) => Promise<T>;
export type AccountLockMode = "exclusive" | "write" | "shared";

export class WatchAccountBusyError extends ConflictException {
	constructor() {
		super("Another Watch operation is in progress. Try again.");
	}
}

/** A checked-out connection owns the session lock until the callback settles.
 * Unlike a transaction advisory lock, a Prisma transaction timeout cannot release
 * it while a PDS request is still running. The application owns this small pool's
 * lifecycle; do not share it with Prisma's query pool. */
export class WatchAccountLock {
	private readonly logger = new Logger(WatchAccountLock.name);
	private remoteOperations = 0;
	constructor(private readonly pool: Pool) {
		if (
			!pool.options.query_timeout ||
			pool.options.query_timeout > 5000 ||
			pool.options.query_timeout < 0 ||
			!pool.options.connectionTimeoutMillis ||
			pool.options.connectionTimeoutMillis > 5000 ||
			pool.options.connectionTimeoutMillis < 0
		) {
			throw new Error(
				"Watch lock pool requires connection and query timeouts between 1 and 5000ms",
			);
		}
	}

	async run<T>(
		ownerDid: string,
		operation: (signal: AbortSignal, withWrite: WithAccountWrite) => Promise<T>,
		{
			wait = false,
			mode = "exclusive",
			scope = "watches",
			operationName = "unspecified",
		}: {
			wait?: boolean;
			mode?: AccountLockMode;
			scope?: "watches" | "content";
			operationName?: string;
		} = {},
	): Promise<T> {
		const startedAt = Date.now();
		const context = {
			lockId: randomUUID(),
			accountHash: createHash("sha256").update(ownerDid).digest("hex"),
			operation: operationName,
			requestId: requestContext.getStore()?.requestId ?? null,
			mode,
			scope,
		};
		// One identifier spans the privacy barrier and each scoped write mutex.
		// Hash the account so logs correlate without recording the DID or content.
		const log = (event: string, namespace?: number, sharedLock?: boolean) => {
			this.logger.log(
				JSON.stringify({
					event: `account_lock.${event}`,
					timestamp: new Date().toISOString(),
					...context,
					namespace,
					shared: sharedLock,
					elapsedMs: Date.now() - startedAt,
				}),
			);
		};
		// Keep one pool connection available for foreground work. Shared remote
		// phases and content background jobs must yield before checking one out.
		const remote = mode === "shared" || scope === "content";
		if (remote && this.remoteOperations >= (this.pool.options.max ?? 10) - 1) {
			log("admission_busy");
			throw new WatchAccountBusyError();
		}
		// Give other accounts a bounded chance to use a released connection.
		// Pool connectionTimeoutMillis caps the wait; cap queue length as well.
		if (this.pool.waitingCount >= 16) {
			log("queue_full");
			throw new ServiceUnavailableException(
				"Watch operations are busy. Try again shortly.",
			);
		}
		if (remote) this.remoteOperations++;
		const client = await this.pool.connect().catch(() => {
			log("connection_failed");
			if (remote) this.remoteOperations--;
			throw new ServiceUnavailableException(
				"Watch operations are busy. Try again shortly.",
			);
		});
		let acquired = false;
		let writeAcquired = false;
		let active = true;
		let broken = false;
		const controller = new AbortController();
		const onError = () => {
			log("connection_invalidated");
			broken = true;
			controller.abort(new Error("Watch operation lost its account lock"));
		};
		client.on("error", onError);
		// 252 excludes privacy changes/deletion. Content background work uses
		// a separate mutex so it cannot hold up interactive Watch writes.
		const writeNamespace = scope === "content" ? 254 : 253;
		// Always acquire in that order, on this same checked-out session.
		const shared = mode !== "exclusive";
		const acquire = async (namespace: number, sharedLock = false) => {
			log("acquiring", namespace, sharedLock);
			const suffix = sharedLock ? "_shared" : "";
			const { rows } = await client
				.query<{ acquired: boolean }>({
					text: wait
						? `SELECT pg_advisory_lock${suffix}(hashtextextended($1, ${namespace}))`
						: `SELECT pg_try_advisory_lock${suffix}(hashtextextended($1, ${namespace})) AS acquired`,
					values: [ownerDid],
				})
				.catch((error) => {
					// Acquisition timeouts have an unknown outcome: abort and discard the session.
					log("acquisition_failed", namespace, sharedLock);
					onError();
					if (
						wait &&
						error instanceof Error &&
						error.message === "Query read timeout"
					)
						throw new WatchAccountBusyError();
					throw error;
				});
			if (!wait && rows[0]?.acquired !== true) {
				log("busy", namespace, sharedLock);
				throw new WatchAccountBusyError();
			}
			log("acquired", namespace, sharedLock);
		};
		const advanceWriteGeneration = async () => {
			if (scope !== "watches") return;
			try {
				await client.query({
					text: 'UPDATE "User" SET "watchWriteGeneration" = "watchWriteGeneration" + 1 WHERE did = $1',
					values: [ownerDid],
				});
			} catch (error) {
				onError();
				throw error;
			}
		};
		const unlockWrite = async () => {
			if (!writeAcquired || broken) return;
			try {
				await client.query({
					text: `SELECT pg_advisory_unlock(hashtextextended($1, ${writeNamespace}))`,
					values: [ownerDid],
				});
				log("released", writeNamespace, false);
				writeAcquired = false;
			} catch (error) {
				onError();
				throw error;
			}
		};
		const withWrite: WithAccountWrite = async (work) => {
			if (!active) throw new Error("Account lock operation has ended");
			controller.signal.throwIfAborted();
			if (mode !== "shared") return work();
			await acquire(writeNamespace);
			writeAcquired = true;
			try {
				await advanceWriteGeneration();
				controller.signal.throwIfAborted();
				return await work();
			} finally {
				await unlockWrite();
			}
		};
		try {
			await acquire(252, shared);
			acquired = true;
			if (mode === "write") {
				await acquire(writeNamespace);
				writeAcquired = true;
				await advanceWriteGeneration();
			}
			controller.signal.throwIfAborted();
			const result = await operation(controller.signal, withWrite);
			if (broken) throw new Error("Watch operation lost its account lock");
			return result;
		} finally {
			active = false;
			try {
				await unlockWrite();
				if (acquired && !broken) {
					await client.query({
						text: `SELECT pg_advisory_unlock${shared ? "_shared" : ""}(hashtextextended($1, 252))`,
						values: [ownerDid],
					});
					log("released", 252, shared);
				}
			} catch {
				broken = true;
			}
			client.removeListener("error", onError);
			client.release(broken);
			log(broken ? "discarded" : "finished");
			if (remote) this.remoteOperations--;
		}
	}
}
