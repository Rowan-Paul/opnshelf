// Export generated SDK
export * from './generated';

// Export TanStack Query hooks
export * from './generated/@tanstack/react-query.gen';

// Export client configuration utilities
export { client } from './generated/client.gen';
export { createClient, createConfig } from './generated/client';
export type { Client, ClientOptions, Config, Options } from './generated/client';

// Re-export auth utilities from custom client wrapper
export {
	setOnUnauthorized,
	setSessionToken,
	getSessionToken,
	configureApiClient,
	getLoginUrl,
	getSignupUrl,
	type AuthUser,
} from './client';
