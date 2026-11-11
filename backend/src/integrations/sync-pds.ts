import type { AuthService } from "../auth/auth.service";
import {
	pdsRequestError,
	PdsRequestError,
	retryAfterSeconds,
} from "../common/pds-request-error";
import { IntegrationError } from "./integration-error";

const REQUEST_INTERVAL_MS = 1100;
type Queue = {
	tail: Promise<void>;
	nextAt: number;
	retryAt: number;
	pending: number;
};

/** Shared by sync adapters, so reads and writes spend the same account budget.
 * ponytail: per-process pacing; a shared limiter is needed for parallel workers.
 */
export class SyncPdsRequests {
	private readonly accounts = new Map<string, Queue>();

	async run<T>(did: string, request: () => Promise<T>): Promise<T> {
		let queue = this.accounts.get(did);
		if (!queue) {
			for (const [key, state] of this.accounts)
				if (
					!state.pending &&
					Math.max(state.nextAt, state.retryAt) <= Date.now()
				)
					this.accounts.delete(key);
			queue = { tail: Promise.resolve(), nextAt: 0, retryAt: 0, pending: 0 };
			this.accounts.set(did, queue);
		}
		const previous = queue.tail;
		let release!: () => void;
		queue.tail = new Promise<void>((resolve) => {
			release = resolve;
		});
		queue.pending++;
		await previous;
		try {
			if (queue.retryAt > Date.now())
				throw new PdsRequestError(
					429,
					Math.ceil((queue.retryAt - Date.now()) / 1000),
				);
			const delay = queue.nextAt - Date.now();
			if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
			queue.nextAt = Date.now() + REQUEST_INTERVAL_MS;
			const result = await request();
			if (result instanceof Response && result.status === 429) {
				const error = new PdsRequestError(
					429,
					retryAfterSeconds(result.headers.get("retry-after"), 300),
				);
				await result.body?.cancel().catch(() => undefined);
				throw error;
			}
			return result;
		} catch (error) {
			const failure = pdsRequestError(error);
			if (failure?.upstreamStatus === 429)
				queue.retryAt = Math.max(
					queue.retryAt,
					Date.now() + failure.retrySeconds * 1000,
				);
			throw failure ?? error;
		} finally {
			queue.pending--;
			release();
		}
	}
}

export const syncPdsRequests = new SyncPdsRequests();

/** Restore failures and every authenticated request share the sync cooldown.
 * The proxy binds SDK methods to their original instance (private fields).
 */
export async function syncPdsSession(
	auth: Pick<AuthService, "restore">,
	did: string,
) {
	const session = await syncPdsRequests.run(did, () => auth.restore(did));
	if (!session)
		throw new IntegrationError(
			"Sign in to Opnshelf again to continue syncing.",
			401,
		);
	return new Proxy(session, {
		get(target, key) {
			if (key === "fetchHandler")
				return (path: string, init?: RequestInit) =>
					syncPdsRequests.run(did, () => target.fetchHandler(path, init));
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}

export function syncPdsFailure(error: unknown) {
	if (error instanceof IntegrationError) return error;
	const failure = pdsRequestError(error);
	return failure
		? new IntegrationError(
				failure.message,
				failure.upstreamStatus,
				failure.retrySeconds,
			)
		: error;
}
