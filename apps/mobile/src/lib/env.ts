import Constants from "expo-constants";

/**
 * Runtime config sourced from `app.config.ts` -> `extra`, which itself reads
 * from `EXPO_PUBLIC_*` env vars at build time. No secrets are hardcoded.
 */
type Extra = {
	apiUrl?: string;
	posthogApiKey?: string;
	posthogHost?: string;
	turnstileSiteKey?: string;
	pdsHandleDomain?: string;
	siteUrl?: string;
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
	// Cloudflare Turnstile site key for the signup captcha (public key). When
	// unset the captcha is skipped (dev escape hatch — the backend likewise
	// disables verification when TURNSTILE_SECRET_KEY is unset).
	turnstileSiteKey:
		process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? extra.turnstileSiteKey,
	// Handle domain new accounts are created on (the PDS host), e.g.
	// "opnshelf.social". Used to preview the user's handle during signup.
	pdsHandleDomain:
		process.env.EXPO_PUBLIC_PDS_HANDLE_DOMAIN ??
		extra.pdsHandleDomain ??
		"opnshelf.social",
	// Public site origin. Used as the WebView document origin for the Turnstile
	// widget so its hostname matches the site key's allowed hostnames.
	siteUrl:
		process.env.EXPO_PUBLIC_SITE_URL ?? extra.siteUrl ?? "https://opnshelf.xyz",
} as const;
