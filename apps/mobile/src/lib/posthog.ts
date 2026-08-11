import PostHog from "posthog-react-native";
import { env } from "./env";

const apiKey = env.posthogApiKey?.trim();
const host = env.posthogHost;

/**
 * PostHog is enabled only when a real key is provided via env. When the key is
 * empty or missing we do NOT construct the client at all — the SDK throws
 * "You must pass your PostHog project's api key" even in disabled mode, so the
 * provider is simply skipped (see components/Providers.tsx) and `posthog` is
 * left null. The rest of the app must guard on `isPostHogEnabled`/null.
 */
// ponytail: dev builds read the production key from apps/mobile/.env, so gate
// on __DEV__ rather than running a second PostHog project. Preview builds are
// already disabled by the placeholder key in eas.json.
export const isPostHogEnabled =
	!__DEV__ && !!apiKey && apiKey !== "phc_your_api_key_here";

if (!isPostHogEnabled && !__DEV__) {
	console.warn(
		"PostHog key not configured (EXPO_PUBLIC_POSTHOG_KEY). Analytics disabled.",
	);
}

export const posthog =
	isPostHogEnabled && apiKey
		? new PostHog(apiKey, {
				host,
				captureAppLifecycleEvents: true,
				flushAt: 20,
				flushInterval: 10000,
			})
		: null;
