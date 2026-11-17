/**
 * Every Integration provider, by the id stored on its connection rows, with
 * its User-facing name. Code that must cover all providers (sync warnings,
 * account deletion) is typed against this, so adding one here shows what
 * else has to handle it.
 */
export const INTEGRATION_PROVIDERS = {
	trakt: "Trakt",
	popfeed: "Popfeed",
	bingers: "Bingers",
} as const;

export type IntegrationProviderId = keyof typeof INTEGRATION_PROVIDERS;
