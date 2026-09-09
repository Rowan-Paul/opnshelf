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

/** True when a thrown API error is a 401. */
export function isUnauthorizedError(error: unknown): boolean {
	return getHttpStatus(error) === 401;
}
