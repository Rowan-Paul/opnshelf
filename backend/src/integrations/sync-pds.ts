import type { AuthService } from "../auth/auth.service";
import {
	pdsRequestError,
	PdsRequestError,
	pdsRetrySeconds,
} from "../common/pds-request-error";
import {
	IntegrationError,
	IntegrationUnavailable,
	integrationFailure,
} from "./integration-error";

const REQUEST_INTERVAL_MS = 1100;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
// Reserve half the documented Bluesky account budget for interactive use.
// https://bsky.network/docs/rate-limits/
const WRITE_BUDGETS = [
	[HOUR_MS, 2500],
	[DAY_MS, 17500],
] as const;
type Queue = {
	tail: Promise<void>;
	nextAt: number;
	retryAt: number;
	pending: number;
	writes: { at: number; points: number }[];
};

/** Shared by sync adapters, so reads and writes spend the same account budget.
 * ponytail: per-process pacing; a shared limiter is needed for parallel workers.
 */
export class SyncPdsRequests {
	private readonly accounts = new Map<string, Queue>();

	async run<T>(did: string, request: () => Promise<T>, points = 0): Promise<T> {
		let queue = this.accounts.get(did);
		if (!queue) {
			for (const [key, state] of this.accounts)
				if (
					!state.pending &&
					Math.max(
						state.nextAt,
						state.retryAt,
						(state.writes.at(-1)?.at ?? 0) + DAY_MS,
					) <= Date.now()
				)
					this.accounts.delete(key);
			queue = {
				tail: Promise.resolve(),
				nextAt: 0,
				retryAt: 0,
				pending: 0,
				writes: [],
			};
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
			if (points) {
				const now = Date.now();
				queue.writes = queue.writes.filter((write) => write.at > now - DAY_MS);
				for (const [window, budget] of WRITE_BUDGETS) {
					const writes = queue.writes.filter(
						(write) => write.at > now - window,
					);
					let total = writes.reduce((sum, write) => sum + write.points, points);
					for (const write of writes) {
						if (total <= budget) break;
						queue.retryAt = Math.max(queue.retryAt, write.at + window);
						total -= write.points;
					}
				}
				if (queue.retryAt > now)
					throw new PdsRequestError(
						429,
						Math.ceil((queue.retryAt - now) / 1000),
					);
				queue.writes.push({ at: now, points });
			}
			queue.nextAt = Date.now() + REQUEST_INTERVAL_MS;
			const result = await request();
			if (result instanceof Response && result.status === 429) {
				const error = new PdsRequestError(
					429,
					pdsRetrySeconds(result.headers, 300),
				);
				await result.body?.cancel().catch(() => undefined);
				throw error;
			}
			if (
				result instanceof Response &&
				result.ok &&
				result.headers.get("ratelimit-remaining") === "0"
			)
				queue.retryAt = Math.max(
					queue.retryAt,
					Date.now() + pdsRetrySeconds(result.headers, 300) * 1000,
				);
			return result;
		} catch (error) {
			const failure = pdsRequestError(error);
			if (failure?.upstreamStatus === 429)
				queue.retryAt = Math.max(
					queue.retryAt,
					Date.now() + failure.retrySeconds * 1000,
				);
			throw syncPdsFailure(failure ?? error);
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
					syncPdsRequests.run(
						did,
						() => target.fetchHandler(path, init),
						syncWritePoints(path, init),
					);
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}

export function syncPdsFailure(error: unknown) {
	const typed = integrationFailure(error);
	if (typed instanceof IntegrationError) return typed;
	const failure = pdsRequestError(error);
	return failure
		? new IntegrationUnavailable(
				failure.message,
				failure.upstreamStatus,
				failure.retrySeconds,
			)
		: error;
}

/** Charge conservatively: putRecord can create, and applyWrites charges each record. */
function syncWritePoints(path: string, init?: RequestInit) {
	const method = path.split("?")[0].split("/").at(-1) ?? "";
	if (!/^com\.atproto\.(repo|space)\./.test(method)) return 0;
	if (method.endsWith(".deleteRecord")) return 1;
	if (method.endsWith(".createRecord") || method.endsWith(".putRecord"))
		return 3;
	if (!method.endsWith(".applyWrites")) return 0;
	const body = JSON.parse(String(init?.body)) as {
		writes: { $type?: string }[];
	};
	return body.writes.reduce(
		(points, write) => points + (write.$type?.endsWith("#delete") ? 1 : 3),
		0,
	);
}
