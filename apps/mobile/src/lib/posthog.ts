import Constants from "expo-constants";
import * as Updates from "expo-updates";
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

/**
 * Release tagging. Every event carries the EAS release it came from, so an
 * exception in PostHog links straight to the update or build on expo.dev
 * instead of being matched to a deploy by timestamp. The keys are the ones
 * PostHog's Expo integration recognises; keep them verbatim.
 *
 * `updateId` and `channel` are null while the embedded bundle of a store build
 * runs; `runtimeVersion` still says which native build that was. Registered
 * right after construction, so the SDK's own "Application Opened" event
 * carries the properties too.
 */
void posthog?.register({
	"eas/update_id": Updates.updateId,
	"eas/channel": Updates.channel,
	"eas/runtime_version": Updates.runtimeVersion,
	"eas/project_id": Constants.expoConfig?.extra?.eas?.projectId ?? null,
	"eas/account": Constants.expoConfig?.owner ?? null,
});
