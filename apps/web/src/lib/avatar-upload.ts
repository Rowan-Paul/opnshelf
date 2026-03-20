const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export const AVATAR_UPLOAD_HELP_TEXT =
	"Use a JPEG, PNG, or WebP image up to 5 MB.";

type UploadLike = {
	size?: number | null;
	type?: string | null;
};

export function validateAvatarFile(file: UploadLike): string | null {
	if (typeof file.size === "number" && file.size > AVATAR_MAX_BYTES) {
		return `Profile photo is too large. ${AVATAR_UPLOAD_HELP_TEXT}`;
	}

	if (
		typeof file.type === "string" &&
		file.type !== "" &&
		!ALLOWED_AVATAR_MIME_TYPES.has(file.type)
	) {
		return "Profile photo must be a JPEG, PNG, or WebP image.";
	}

	return null;
}

export function getAvatarUploadErrorMessage(
	error: unknown,
	fallback: string,
): string {
	const status =
		getNumericValue(error, ["statusCode"]) ??
		getNumericValue(error, ["status"]) ??
		getNumericValue(error, ["response", "status"]);
	const message = getStringMessage(error)?.toLowerCase() ?? "";

	if (
		status === 413 ||
		message.includes("5 mb") ||
		message.includes("too large") ||
		message.includes("payload too large")
	) {
		return `Profile photo is too large. ${AVATAR_UPLOAD_HELP_TEXT}`;
	}

	if (
		status === 415 ||
		message.includes("unsupported") ||
		message.includes("media type")
	) {
		return "Profile photo must be a JPEG, PNG, or WebP image.";
	}

	return getStringMessage(error) ?? fallback;
}

function getStringMessage(error: unknown): string | null {
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
		if (Array.isArray(message)) {
			const joined = message
				.filter((value): value is string => typeof value === "string")
				.join(", ");
			if (joined.trim() !== "") {
				return joined;
			}
		}
	}

	if ("body" in error) {
		const nested = getStringMessage((error as { body?: unknown }).body);
		if (nested) {
			return nested;
		}
	}

	if ("error" in error) {
		const nested = getStringMessage((error as { error?: unknown }).error);
		if (nested) {
			return nested;
		}
	}

	return null;
}

function getNumericValue(error: unknown, path: string[]): number | null {
	let current: unknown = error;
	for (const segment of path) {
		if (!current || typeof current !== "object" || !(segment in current)) {
			return null;
		}
		current = (current as Record<string, unknown>)[segment];
	}

	return typeof current === "number" ? current : null;
}
