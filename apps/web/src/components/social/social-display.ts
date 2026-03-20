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

export function getSocialDisplayName(value: unknown, fallback: string) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value;
	}

	return getHandleDisplayName(fallback);
}

export function getOptionalString(value: unknown) {
	return typeof value === "string" && value.length > 0 ? value : null;
}
