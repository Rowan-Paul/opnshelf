import PostHog from "posthog-react-native";
import { env } from "./env";

const apiKey = env.posthogApiKey?.trim();
const host = env.posthogHost;
const isProductionApi =
	env.apiUrl.replace(/\/+$/, "") === "https://api.opnshelf.xyz";
const hasApiKey = !!apiKey && apiKey !== "phc_your_api_key_here";

/**
 * PostHog is enabled only for the production API with a real key. When the key is
 * empty or missing we do NOT construct the client at all — the SDK throws
 * "You must pass your PostHog project's api key" even in disabled mode, so the
 * provider is simply skipped (see components/Providers.tsx) and `posthog` is
 * left null. The rest of the app must guard on `isPostHogEnabled`/null.
 */
// Keep Staging and local traffic out even if a production key is supplied.
export const isPostHogEnabled = !__DEV__ && isProductionApi && hasApiKey;

if (!__DEV__ && isProductionApi && !hasApiKey) {
	console.warn(
		"PostHog key not configured (EXPO_PUBLIC_POSTHOG_KEY). Analytics disabled.",
	);
}

export const posthog =
	isPostHogEnabled && apiKey
		? new PostHog(apiKey, {
				host,
				captureAppLifecycleEvents: true,
				errorTracking: {
					autocapture: {
						uncaughtExceptions: true,
						unhandledRejections: true,
					},
				},
				flushAt: 20,
				flushInterval: 10000,
			})
		: null;
