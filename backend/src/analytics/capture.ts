import { createHash } from "node:crypto";
import type { BackendEnv } from "../config/env.schema";

let pending = 0;
const MAX_PENDING = 64;

type Properties = Record<string, string | number | boolean | string[] | null>;

export function isProductAnalyticsEnabled(env: BackendEnv): boolean {
	return (
		env.NODE_ENV === "production" &&
		env.BACKEND_PUBLIC_URL?.replace(/\/+$/, "") ===
			"https://api.opnshelf.xyz" &&
		Boolean(env.POSTHOG_KEY)
	);
}

/** Best-effort product events with bounded in-flight work; no retries or durable queue. */
export function captureProductEvent(
	env: BackendEnv,
	did: string,
	event: string,
	properties: Properties = {},
	identity?: string,
): void {
	if (!isProductAnalyticsEnabled(env) || pending >= MAX_PENDING) return;
	pending++;
	// The event UUID makes repeated first-account observations idempotent at ingestion.
	const hash = identity
		? createHash("sha256").update(identity).digest("hex")
		: null;
	const uuid = hash
		? `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
		: undefined;
	void fetch(
		`${(env.POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/+$/, "")}/i/v0/e/`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: env.POSTHOG_KEY,
				event,
				distinct_id: did,
				uuid,
				timestamp: new Date().toISOString(),
				properties: {
					...properties,
					platform: "backend",
					$lib: "opnshelf-backend",
				},
			}),
			signal: AbortSignal.timeout(3000),
		},
	)
		.then(async (response) => {
			await response.body?.cancel();
		})
		.catch(() => undefined)
		.finally(() => {
			pending--;
		});
}
