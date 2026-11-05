/**
 * Stable, categorical reasons an error response can carry as `code`.
 *
 * Messages are written for people and may change; a code is for clients and
 * error tracking, so a failure reported from another user's device says which
 * case the server hit without carrying the message itself. Only codes listed
 * here reach a response body or a log line (AllExceptionsFilter enforces it),
 * so a code can never echo user input.
 */
export const ERROR_CODES = [
	"VALIDATION_FAILED",
	"USER_NOT_FOUND",
	"EMAIL_CODE_EXPIRED",
	"EMAIL_CODE_INVALID",
	"EMAIL_VERIFICATION_FAILED",
	"INTEGRATION_NOT_CONNECTED",
	"SYNC_BUSY",
	"SYNC_OWNERSHIP_CHANGED",
	"PRIVACY_ACCOUNT_BUSY",
	"PRIVACY_ACCOUNT_DELETING",
	"PRIVACY_CATEGORY_MIGRATING",
	"PRIVACY_PUBLICATION_UNCONFIRMED",
	"PRIVACY_MIGRATION_CONFLICT",
	"PRIVACY_MIGRATION_IN_PROGRESS",
	"PRIVACY_MIGRATION_NOT_READY",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
	return (
		typeof value === "string" &&
		(ERROR_CODES as readonly string[]).includes(value)
	);
}

/** Response object for an HttpException that carries a code. */
export function coded(code: ErrorCode, message: string) {
	return { code, message };
}
