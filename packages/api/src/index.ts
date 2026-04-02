// Export generated SDK

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
export {
	getYouTubeEmbedUrl,
	getYouTubeThumbnailUrl,
	resolveDetailTrailer,
} from "./trailer";
export type { AccountDeletionStatusJob } from "./account-deletion-status";
export {
	getAccountDeletionProgress,
	getAccountDeletionStatusMessage,
	getAccountDeletionStepLabel,
	isActiveAccountDeletionStatus,
	isTerminalAccountDeletionStatus,
} from "./account-deletion-status";
export type { TraktImportStatusJob } from "./trakt-import-status";
export {
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	isKnownTraktImportStatus,
	isTerminalTraktImportStatus,
} from "./trakt-import-status";

// TODO: Remove these manual exports after running `pnpm generate:api`
// People API - temporary manual implementation until backend codegen is run
export type {
	PersonFilmographyItemDto,
	TmdbPersonDetailDto,
	PeopleControllerGetPersonDetailsData,
	PeopleControllerGetPersonDetailsResponse,
} from "./people-temp";
export { peopleControllerGetPersonDetails } from "./people-temp";
export {
	peopleControllerGetPersonDetailsOptions,
	peopleControllerGetPersonDetailsQueryKey,
} from "./people-temp";
