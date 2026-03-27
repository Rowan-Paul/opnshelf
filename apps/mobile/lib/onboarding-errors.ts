const SAFE_ONBOARDING_MESSAGES = new Set([
	"This watch was already imported.",
	"We couldn't fetch details for this title right now.",
	"We couldn't save this watch right now. Please try again.",
	"We couldn't import this item.",
	"Trakt user not found",
	"Trakt profile is private or unavailable. Try CSV import instead.",
	"Trakt rate limit reached. We will retry in the background shortly.",
	"Trakt is temporarily unavailable. Please retry later or use CSV import.",
]);

const MAX_VISIBLE_IMPORT_ERRORS = 10;

export function getSafeOnboardingErrorMessage(
	error: unknown,
	fallback: string,
): string {
	const message = getNestedStringMessage(error);
	if (message && SAFE_ONBOARDING_MESSAGES.has(message)) {
		return message;
	}

	return fallback;
}

export function getSafeImportErrorMessage(message: string): string {
	return SAFE_ONBOARDING_MESSAGES.has(message)
		? message
		: "We couldn't import this item.";
}

export function buildImportErrorList(
	localMessages: string[],
	serverMessages: string[],
): string[] {
	const uniqueMessages = Array.from(
		new Set([
			...localMessages,
			...serverMessages.map((message) => getSafeImportErrorMessage(message)),
		]),
	);

	if (uniqueMessages.length <= MAX_VISIBLE_IMPORT_ERRORS) {
		return uniqueMessages;
	}

	const remainingCount = uniqueMessages.length - MAX_VISIBLE_IMPORT_ERRORS;
	return [
		...uniqueMessages.slice(0, MAX_VISIBLE_IMPORT_ERRORS),
		`...and ${remainingCount} more`,
	];
}

function getNestedStringMessage(error: unknown): string | null {
	if (typeof error === "string" && error.trim() !== "") {
		return error;
	}

	if (!error || typeof error !== "object") {
		return null;
	}

	if ("message" in error) {
		const { message } = error as { message?: unknown };
		if (typeof message === "string" && message.trim() !== "") {
			return message;
		}
	}

	if ("body" in error) {
		const nested = getNestedStringMessage((error as { body?: unknown }).body);
		if (nested) {
			return nested;
		}
	}

	if ("error" in error) {
		const nested = getNestedStringMessage((error as { error?: unknown }).error);
		if (nested) {
			return nested;
		}
	}

	return null;
}
