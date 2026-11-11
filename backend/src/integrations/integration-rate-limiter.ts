import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import {
	rateLimitRetrySeconds,
	rateLimitExhausted,
} from "../common/rate-limit-headers";
import {
	IntegrationError,
	IntegrationUnavailable,
	integrationFailure,
} from "./integration-error";
/** A leased connection keeps one budget across OAuth token rotation. */
export const integrationRateLimitScope = new AsyncLocalStorage<string>();
export function integrationRateLimitKey(token?: string) {
	return (
		integrationRateLimitScope.getStore() ??
		(token ? createHash("sha256").update(token).digest("hex") : "oauth")
	);
}

export type IntegrationRateLimitPolicy = {
	name: string;
	intervalMs: number;
	retrySeconds: number;
	budgets?: readonly (readonly [windowMs: number, points: number])[];
	requestPoints?: number;
};
type Queue = {
	tail: Promise<void>;
	nextAt: number;
	retryAt: number;
	pending: number;
	usage: { at: number; points: number }[];
};

/** Serializes each credential/account scope and shares pacing, budgets and cooldowns.
 * ponytail: per-process pacing; a shared limiter is needed for parallel workers.
 */
export class IntegrationRateLimiter {
	constructor(private readonly policy: IntegrationRateLimitPolicy) {}
	private limited(retrySeconds: number) {
		return new IntegrationUnavailable(
			`${this.policy.name} rate limit reached. Sync will retry.`,
			429,
			retrySeconds,
		);
	}
	private get retentionMs() {
		return Math.max(
			0,
			...(this.policy.budgets ?? []).map(([window]) => window),
		);
	}
	private readonly accounts = new Map<string, Queue>();

	async run<T>(
		scopeKey: string,
		request: () => Promise<T>,
		points = this.policy.requestPoints ?? 0,
	): Promise<T> {
		let queue = this.accounts.get(scopeKey);
		if (!queue) {
			for (const [key, state] of this.accounts)
				if (
					!state.pending &&
					Math.max(
						state.nextAt,
						state.retryAt,
						(state.usage.at(-1)?.at ?? 0) + this.retentionMs,
					) <= Date.now()
				)
					this.accounts.delete(key);
			queue = {
				tail: Promise.resolve(),
				nextAt: 0,
				retryAt: 0,
				pending: 0,
				usage: [],
			};
			this.accounts.set(scopeKey, queue);
		}
		const previous = queue.tail;
		let release!: () => void;
		queue.tail = new Promise<void>((resolve) => {
			release = resolve;
		});
		queue.pending++;
		await previous;
		let localCooldown = false;
		try {
			if (queue.retryAt - Date.now() > this.policy.intervalMs) {
				localCooldown = true;
				throw this.limited(Math.ceil((queue.retryAt - Date.now()) / 1000));
			}
			const delay = Math.max(queue.nextAt, queue.retryAt) - Date.now();
			if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
			if (points) {
				const now = Date.now();
				queue.usage = queue.usage.filter(
					(entry) => entry.at > now - this.retentionMs,
				);
				for (const [window, budget] of this.policy.budgets ?? []) {
					if (points > budget)
						throw new IntegrationError(
							"This transfer exceeds the sync request budget. Your changes are preserved.",
						);
					const usage = queue.usage.filter((entry) => entry.at > now - window);
					let total = usage.reduce((sum, entry) => sum + entry.points, points);
					for (const entry of usage) {
						if (total <= budget) break;
						queue.retryAt = Math.max(queue.retryAt, entry.at + window);
						total -= entry.points;
					}
				}
				if (queue.retryAt > now) {
					localCooldown = true;
					throw this.limited(Math.ceil((queue.retryAt - now) / 1000));
				}
				queue.usage.push({ at: now, points });
			}
			queue.nextAt = Date.now() + this.policy.intervalMs;
			const result = await request();
			if (result instanceof Response && result.status === 429) {
				const error = this.limited(
					rateLimitRetrySeconds(result.headers, this.policy.retrySeconds),
				);
				await result.body?.cancel().catch(() => undefined);
				throw error;
			}
			const headers =
				result instanceof Response
					? result.headers
					: result &&
							typeof result === "object" &&
							"headers" in result &&
							result.headers instanceof Headers
						? result.headers
						: undefined;
			if (headers && rateLimitExhausted(headers))
				queue.retryAt = Math.max(
					queue.retryAt,
					Date.now() +
						rateLimitRetrySeconds(headers, this.policy.retrySeconds) * 1000,
				);
			return result;
		} catch (error) {
			const failure = integrationFailure(error);
			if (
				!localCooldown &&
				failure instanceof IntegrationError &&
				failure.status === 429
			)
				queue.retryAt = Math.max(
					queue.retryAt,
					Date.now() + failure.retrySeconds * 1000,
				);
			throw failure;
		} finally {
			queue.pending--;
			release();
		}
	}
}
