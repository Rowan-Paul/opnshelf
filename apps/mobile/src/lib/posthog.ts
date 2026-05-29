import PostHog from "posthog-react-native";
import { env } from "./env";

const apiKey = env.posthogApiKey;
const host = env.posthogHost;

/**
 * PostHog is enabled only when a real key is provided via env. When absent the
 * client is constructed in disabled mode so the rest of the app can call it
 * unconditionally without sending anything.
 */
export const isPostHogEnabled = !!apiKey && apiKey !== "phc_your_api_key_here";

if (!isPostHogEnabled) {
	console.warn(
		"PostHog key not configured (EXPO_PUBLIC_POSTHOG_KEY). Analytics disabled.",
	);
}

export const posthog = new PostHog(apiKey ?? "placeholder_key", {
	host,
	disabled: !isPostHogEnabled,
	captureAppLifecycleEvents: true,
	flushAt: 20,
	flushInterval: 10000,
});
