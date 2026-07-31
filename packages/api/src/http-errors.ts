/**
 * True when a thrown API error is a 401. The generated client surfaces the code
 * as `status` on some paths and `statusCode` on others, so check both.
 */
export function isUnauthorizedError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		("status" in error || "statusCode" in error) &&
		((error as Record<string, unknown>).status === 401 ||
			(error as Record<string, unknown>).statusCode === 401)
	);
}
