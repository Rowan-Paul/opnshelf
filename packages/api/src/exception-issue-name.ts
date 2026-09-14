/** Name new PostHog issues from the message already approved for capture.
 * Never recover the original error here: mutation reports intentionally omit it.
 * Existing titles and exception fingerprints retain their original meaning.
 */
export function nameExceptionIssue<
	T extends { event: string; properties?: Record<string, unknown> } | null,
>(event: T): T {
	if (!event || event.event !== "$exception" || !event.properties) return event;
	if (event.properties.$issue_name != null) return event;
	const exceptions = event.properties.$exception_list;
	const exception: unknown = Array.isArray(exceptions) ? exceptions[0] : null;
	if (
		typeof exception !== "object" ||
		exception === null ||
		!("value" in exception) ||
		typeof exception.value !== "string"
	)
		return event;
	const message = exception.value.trim();
	if (message) event.properties.$issue_name = message.slice(0, 255);
	return event;
}
