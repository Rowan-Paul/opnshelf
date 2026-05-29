import Constants from "expo-constants";

/**
 * Runtime config sourced from `app.config.ts` -> `extra`, which itself reads
 * from `EXPO_PUBLIC_*` env vars at build time. No secrets are hardcoded.
 */
type Extra = {
	apiUrl?: string;
	posthogApiKey?: string;
	posthogHost?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const env = {
	apiUrl:
		process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://127.0.0.1:3001",
	posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? extra.posthogApiKey,
	posthogHost:
		process.env.EXPO_PUBLIC_POSTHOG_HOST ??
		extra.posthogHost ??
		"https://eu.i.posthog.com",
} as const;
