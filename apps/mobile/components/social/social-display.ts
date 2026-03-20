export function getHandleDisplayName(handle: unknown) {
	if (typeof handle !== "string") {
		return "";
	}

	const trimmed = handle.trim();
	if (trimmed.length === 0) {
		return "";
	}

	const [localPart] = trimmed.split(".");
	return localPart && localPart.length > 0 ? localPart : trimmed;
}

export function getOptionalString(value: unknown) {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export function getDisplayName(value: unknown, fallback: string) {
	return typeof value === "string" && value.trim().length > 0
		? value
		: getHandleDisplayName(fallback);
}
