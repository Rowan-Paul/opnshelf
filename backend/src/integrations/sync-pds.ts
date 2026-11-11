import type { AuthService } from "../auth/auth.service";
import { pdsRequestError } from "../common/pds-request-error";
import {
	IntegrationError,
	IntegrationUnavailable,
	integrationFailure,
} from "./integration-error";
import {
	IntegrationRateLimiter,
	type IntegrationRateLimitPolicy,
} from "./integration-rate-limiter";

const HOUR_MS = 60 * 60_000;
// Reserve half the documented Bluesky write allowances for other account activity.
export const PDS_RATE_LIMIT_POLICY: IntegrationRateLimitPolicy = {
	name: "Your repository",
	intervalMs: 1100,
	retrySeconds: 300,
	budgets: [
		[HOUR_MS, 2500],
		[24 * HOUR_MS, 17500],
	],
};
export const syncPdsRequests = new IntegrationRateLimiter(
	PDS_RATE_LIMIT_POLICY,
);

export async function syncPdsRequest<T>(request: () => Promise<T>): Promise<T> {
	try {
		const result = await request();
		if (
			result instanceof Response &&
			(result.status === 429 || result.status >= 500)
		) {
			const failure = syncPdsFailure(result);
			await result.body?.cancel().catch(() => undefined);
			throw failure;
		}
		return result;
	} catch (error) {
		throw syncPdsFailure(error);
	}
}

/** Restore failures and every authenticated request share the sync cooldown.
 * The proxy binds SDK methods to their original instance (private fields).
 */
export async function syncPdsSession(
	auth: Pick<AuthService, "restore">,
	did: string,
) {
	const session = await syncPdsRequests.run(did, () =>
		syncPdsRequest(() => auth.restore(did)),
	);
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
						() => syncPdsRequest(() => target.fetchHandler(path, init)),
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
	try {
		if (typeof init?.body !== "string") throw new Error();
		const body: unknown = JSON.parse(init.body);
		if (
			!body ||
			typeof body !== "object" ||
			!("writes" in body) ||
			!Array.isArray(body.writes)
		)
			throw new Error();
		return body.writes.reduce(
			(points: number, write: unknown) =>
				points +
				(write &&
				typeof write === "object" &&
				"$type" in write &&
				typeof write.$type === "string" &&
				write.$type.endsWith("#delete")
					? 1
					: 3),
			0,
		);
	} catch {
		throw new IntegrationError(
			"The repository write could not be prepared. Your changes are preserved.",
		);
	}
}
