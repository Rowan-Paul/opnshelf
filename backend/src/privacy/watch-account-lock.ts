import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import type { Pool } from "pg";

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
		}: { wait?: boolean; mode?: AccountLockMode } = {},
	): Promise<T> {
		// Give other accounts a bounded chance to use a released connection.
		// Pool connectionTimeoutMillis caps the wait; cap queue length as well.
		if (this.pool.waitingCount >= 16)
			throw new ServiceUnavailableException(
				"Watch operations are busy. Try again shortly.",
			);
		const client = await this.pool.connect().catch(() => {
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
			broken = true;
			controller.abort(new Error("Watch operation lost its account lock"));
		};
		client.on("error", onError);
		// 252 excludes privacy changes/deletion. 253 serializes local writes.
		// Always acquire in that order, on this same checked-out session.
		const shared = mode !== "exclusive";
		const acquire = async (namespace: number, sharedLock = false) => {
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
					onError();
					if (
						wait &&
						error instanceof Error &&
						error.message === "Query read timeout"
					)
						throw new WatchAccountBusyError();
					throw error;
				});
			if (!wait && rows[0]?.acquired !== true)
				throw new WatchAccountBusyError();
		};
		const unlockWrite = async () => {
			if (!writeAcquired || broken) return;
			try {
				await client.query({
					text: "SELECT pg_advisory_unlock(hashtextextended($1, 253))",
					values: [ownerDid],
				});
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
			await acquire(253);
			writeAcquired = true;
			try {
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
				await acquire(253);
				writeAcquired = true;
			}
			controller.signal.throwIfAborted();
			const result = await operation(controller.signal, withWrite);
			if (broken) throw new Error("Watch operation lost its account lock");
			return result;
		} finally {
			active = false;
			try {
				await unlockWrite();
				if (acquired && !broken)
					await client.query({
						text: `SELECT pg_advisory_unlock${shared ? "_shared" : ""}(hashtextextended($1, 252))`,
						values: [ownerDid],
					});
			} catch {
				broken = true;
			}
			client.removeListener("error", onError);
			client.release(broken);
		}
	}
}
