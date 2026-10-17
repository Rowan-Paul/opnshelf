import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import type { Pool } from "pg";

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
		operation: (signal: AbortSignal) => Promise<T>,
		{ wait = false }: { wait?: boolean } = {},
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
		let broken = false;
		const controller = new AbortController();
		const onError = () => {
			broken = true;
			controller.abort(new Error("Watch operation lost its account lock"));
		};
		client.on("error", onError);
		try {
			const { rows } = await client
				.query<{ acquired: boolean }>({
					// Interactive writes queue behind one transfer; background work
					// yields immediately. The pool's query timeout bounds this wait.
					text: wait
						? "SELECT pg_advisory_lock(hashtextextended($1, 252))"
						: "SELECT pg_try_advisory_lock(hashtextextended($1, 252)) AS acquired",
					values: [ownerDid],
				})
				.catch((error) => {
					// A timed-out acquisition has an unknown result. Destroy this
					// connection rather than return a possibly locked session to the pool.
					broken = true;
					if (
						wait &&
						error instanceof Error &&
						error.message === "Query read timeout"
					)
						throw new WatchAccountBusyError();
					throw error;
				});
			acquired = wait || rows[0]?.acquired === true;
			if (!acquired) throw new WatchAccountBusyError();
			controller.signal.throwIfAborted();
			const result = await operation(controller.signal);
			if (broken) throw new Error("Watch operation lost its account lock");
			return result;
		} finally {
			try {
				if (acquired && !broken)
					await client.query({
						text: "SELECT pg_advisory_unlock(hashtextextended($1, 252))",
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
