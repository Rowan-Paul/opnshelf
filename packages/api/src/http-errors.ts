/**
 * HTTP status carried by a thrown API error, or undefined when the failure
 * never produced a response (network error, aborted request). The generated
 * client surfaces the code as `status` on some paths and `statusCode` on
 * others, so check both.
 */
export function getHttpStatus(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const { status, statusCode } = error as Record<string, unknown>;
	if (typeof status === "number") return status;
	if (typeof statusCode === "number") return statusCode;
	return undefined;
}

/**
 * True when a thrown API error is a 401. Checks both fields independently
 * rather than going through `getHttpStatus`, so an error that carries both
 * still counts as unauthorized when either one says so.
 */
export function isUnauthorizedError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const { status, statusCode } = error as Record<string, unknown>;
	return status === 401 || statusCode === 401;
}

/**
 * Retry policy for a query whose resource can legitimately be missing. A 404
 * is a definitive answer, so retrying it only delays the not-found state by
 * the length of the backoff; every other failure keeps React Query's default
 * three attempts.
 */
export function retryUnlessNotFound(
	failureCount: number,
	error: unknown,
): boolean {
	return getHttpStatus(error) !== 404 && failureCount < 3;
}

/**
 * Default retry policy for queries: retry only failures a second attempt can
 * fix (no response, or a 5xx). A 4xx is the API's definitive answer, and
 * retrying a 429 multiplies the very load that tripped the rate limit.
 */
export function retryTransientFailures(
	failureCount: number,
	error: unknown,
): boolean {
	const status = getHttpStatus(error);
	return (status === undefined || status >= 500) && failureCount < 3;
}
