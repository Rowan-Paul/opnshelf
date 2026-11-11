export function retryAfterSeconds(value: string | null, fallback: number) {
	if (!value?.trim()) return fallback;
	const seconds = Number(value);
	const delay = Number.isFinite(seconds)
		? seconds
		: (Date.parse(value) - Date.now()) / 1000;
	return Number.isFinite(delay) && delay >= 0
		? Math.max(1, Math.ceil(delay))
		: fallback;
}

/** Servers may expose the reset timestamp instead of Retry-After. */
export function rateLimitRetrySeconds(
	headers: Headers | Record<string, string> | undefined,
	fallback: number,
) {
	const values = new Headers(headers);
	const retry = retryAfterSeconds(values.get("retry-after"), 0);
	const reset = Number(values.get("ratelimit-reset"));
	const resetDelay = Number.isFinite(reset)
		? Math.max(0, Math.ceil(reset - Date.now() / 1000))
		: 0;
	const metadata = rateLimitMetadata(values);
	const metadataDelay = metadata?.until
		? Math.max(0, Math.ceil((Date.parse(metadata.until) - Date.now()) / 1000))
		: 0;
	return (
		Math.max(
			retry,
			resetDelay,
			Number.isFinite(metadataDelay) ? metadataDelay : 0,
		) || fallback
	);
}

/** Trakt's documented X-Ratelimit bucket; malformed metadata is ignored. */
function rateLimitMetadata(
	headers: Headers,
): { remaining?: number; until?: string } | undefined {
	try {
		const value: unknown = JSON.parse(headers.get("x-ratelimit") ?? "null");
		if (!value || typeof value !== "object") return undefined;
		return {
			remaining:
				"remaining" in value && typeof value.remaining === "number"
					? value.remaining
					: undefined,
			until:
				"until" in value && typeof value.until === "string"
					? value.until
					: undefined,
		};
	} catch {
		return undefined;
	}
}

export function rateLimitExhausted(headers: Headers) {
	return (
		headers.get("ratelimit-remaining") === "0" ||
		rateLimitMetadata(headers)?.remaining === 0
	);
}
