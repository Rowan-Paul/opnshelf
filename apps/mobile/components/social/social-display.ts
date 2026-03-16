export function getOptionalString(value: unknown) {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export function getDisplayName(value: unknown, fallback: string) {
	return getOptionalString(value) ?? fallback;
}
