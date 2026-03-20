const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export const AVATAR_UPLOAD_HELP_TEXT = "Use a JPEG, PNG, or WebP image up to 5 MB.";

type UploadLike = {
	fileSize?: number | null;
	fileName?: string | null;
	mimeType?: string | null;
	uri?: string | null;
};

export type ReactNativeUploadFile = {
	uri: string;
	name: string;
	type: string;
};

export function validateAvatarAsset(asset: UploadLike): string | null {
	if (typeof asset.fileSize === "number" && asset.fileSize > AVATAR_MAX_BYTES) {
		return `Profile photo is too large. ${AVATAR_UPLOAD_HELP_TEXT}`;
	}

	const mimeType = normalizeAvatarMimeType(asset.mimeType);
	if (
		mimeType !== null &&
		mimeType !== "" &&
		!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)
	) {
		return "Profile photo must be a JPEG, PNG, or WebP image.";
	}

	return null;
}

export function createAvatarUploadFile(asset: UploadLike): ReactNativeUploadFile {
	if (typeof asset.uri !== "string" || asset.uri.trim() === "") {
		throw new Error("Profile photo URI is required");
	}

	const mimeType =
		normalizeAvatarMimeType(asset.mimeType) ??
		inferMimeTypeFromUri(asset.uri) ??
		"image/jpeg";
	const extension = getExtensionForMimeType(mimeType);
	const baseName =
		normalizeFileName(asset.fileName) ??
		getFileNameFromUri(asset.uri) ??
		`avatar${extension}`;
	const name =
		baseName.includes(".") || extension === "" ? baseName : `${baseName}${extension}`;

	return {
		uri: asset.uri,
		name,
		type: mimeType,
	};
}

export function toMultipartUploadValue(file: ReactNativeUploadFile): Blob {
	return file as unknown as Blob;
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

function normalizeAvatarMimeType(mimeType: string | null | undefined): string | null {
	if (typeof mimeType !== "string") {
		return null;
	}

	const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
	if (normalized === "") {
		return null;
	}
	if (normalized === "image/jpg") {
		return "image/jpeg";
	}
	return normalized;
}

function inferMimeTypeFromUri(uri: string): string | null {
	const extension = getFileExtension(uri);
	switch (extension) {
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "webp":
			return "image/webp";
		default:
			return null;
	}
}

function getExtensionForMimeType(mimeType: string): string {
	switch (mimeType) {
		case "image/jpeg":
			return ".jpg";
		case "image/png":
			return ".png";
		case "image/webp":
			return ".webp";
		default:
			return "";
	}
}

function normalizeFileName(fileName: string | null | undefined): string | null {
	if (typeof fileName !== "string") {
		return null;
	}

	const trimmed = fileName.trim();
	return trimmed === "" ? null : trimmed;
}

function getFileNameFromUri(uri: string): string | null {
	const trimmed = uri.trim();
	if (trimmed === "") {
		return null;
	}

	const withoutQuery = trimmed.split("?")[0] ?? trimmed;
	const segments = withoutQuery.split("/");
	const lastSegment = segments.at(-1)?.trim() ?? "";
	return lastSegment === "" ? null : lastSegment;
}

function getFileExtension(uri: string): string {
	const fileName = getFileNameFromUri(uri);
	if (!fileName || !fileName.includes(".")) {
		return "";
	}

	return fileName.split(".").at(-1)?.toLowerCase() ?? "";
}
