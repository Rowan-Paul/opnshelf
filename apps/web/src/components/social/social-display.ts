export function getSocialDisplayName(value: unknown, fallback: string) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value;
	}

	return fallback;
}

export function getOptionalString(value: unknown) {
	return typeof value === "string" && value.length > 0 ? value : null;
}
