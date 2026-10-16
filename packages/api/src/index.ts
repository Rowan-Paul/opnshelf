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
	setDeviceIdentity,
	setOnUnauthorized,
	setSessionToken,
} from "./client";
export { nameExceptionIssue } from "./exception-issue-name";
export {
	activeFeaturedItems,
	featuredTitle,
	scheduleFeaturedExpiry,
} from "./featured-content";
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
	type GenreDiscovery,
	genreDiscoverySearch,
	parseGenreDiscovery,
} from "./genre-discovery";
export {
	getErrorMessage,
	getHttpStatus,
	isUnauthorizedError,
	retryTransientFailures,
	retryUnlessNotFound,
} from "./http-errors";
export {
	type ListItemRef,
	type ListRef,
	listsForItem,
	movieWatchCount,
	withMembership,
	withMovieWatch,
	withoutMovieWatches,
} from "./list-memberships";
export { slugifyName } from "./media-slug";
export {
	describeMutationFailure,
	MutationFailedError,
	type MutationFailureReport,
} from "./mutation-failure";
export { onboardingDiscoveryOptions } from "./onboarding-discovery";
export { preparePostHogEvent } from "./posthog-event";
export {
	type PrivacyAction,
	privacyActionKey,
	privacyErrorMessage,
	privacyProgressTitle,
	usePrivacy,
	usePrivacyProgress,
} from "./privacy";
export * from "./release-notes";
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
export * from "./trakt-sync";
export {
	invalidateWatchActivityQueries,
	isWatchActivityQueryKey,
	WATCH_ACTIVITY_QUERY_IDS,
} from "./watch-activity-queries";
export {
	choosePickerItem,
	initialPickerFilters,
	PICKER_GENRES,
	type PickerFilters,
	pickerEpisodeLabel,
	pickerServiceLabel,
	restorePickerFilters,
} from "./watch-picker";
export { getWatchProviderLink } from "./watch-provider-link";
