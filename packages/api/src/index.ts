// Export generated SDK

export type { AccountDeletionStatusJob } from "./account-deletion-status";
export {
	getAccountDeletionProgress,
	getAccountDeletionStatusMessage,
	getAccountDeletionStepLabel,
	isActiveAccountDeletionStatus,
	isTerminalAccountDeletionStatus,
} from "./account-deletion-status";
// Re-export auth utilities from custom client wrapper
export {
	type AuthUser,
	type BlueskyProfileStatus,
	configureApiClient,
	getBlueskyProfileStatus,
	getLoginUrl,
	getSessionToken,
	getSignupUrl,
	setOnUnauthorized,
	setSessionToken,
} from "./client";
// Export TanStack Query hooks
export * from "./generated/@tanstack/react-query.gen";
export type {
	Client,
	ClientOptions,
	Config,
	Options,
} from "./generated/client/index";
export { createClient, createConfig } from "./generated/client/index";
// Export client configuration utilities
export { client } from "./generated/client.gen";
export * from "./generated/index";
export { isUnauthorizedError } from "./http-errors";
export {
	getYouTubeEmbedUrl,
	getYouTubeThumbnailUrl,
	resolveDetailTrailer,
} from "./trailer";
export type { TraktImportStatusJob } from "./trakt-import-status";
export {
	formatRetryCountdown,
	getRetryReason,
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	isKnownTraktImportStatus,
	isTerminalTraktImportStatus,
} from "./trakt-import-status";
export {
	invalidateWatchActivityQueries,
	isWatchActivityQueryKey,
	WATCH_ACTIVITY_QUERY_IDS,
} from "./watch-activity-queries";
