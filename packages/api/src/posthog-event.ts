import { nameExceptionIssue } from "./exception-issue-name";

/** Shared send hook for manual and automatically captured client exceptions. */
export function preparePostHogEvent<
	T extends { event: string; properties?: Record<string, unknown> } | null,
>(event: T): T | null {
	if (event?.event === "$exception" && event.properties) {
		const { http_status, $exception_list } = event.properties;
		if (http_status === 429 || http_status === "429") return null;
		// React may wrap a rate-limit failure in a rendering error. Inspect the
		// full cause chain, not just the outer exception or the issue title.
		if (Array.isArray($exception_list) && $exception_list.some(isRateLimit))
			return null;
	}
	return nameExceptionIssue(event);
}

function isRateLimit(exception: unknown): boolean {
	if (typeof exception !== "object" || exception === null) return false;
	if ("type" in exception && exception.type === "ThrottlerException")
		return true;
	return (
		"value" in exception &&
		typeof exception.value === "string" &&
		/^(?:ThrottlerException:\s*)?Too Many Requests$/i.test(
			exception.value.trim(),
		)
	);
}
