import type { ExpoConfig } from "expo/config";

/**
 * Expo config. Secrets (PostHog key/host, API URL) are read from the
 * environment at build time and surfaced via `extra` so the running app can
 * read them through `expo-constants`. Never hardcode keys here.
 */
const config: ExpoConfig = {
	name: "Opnshelf",
	slug: "opnshelf",
	owner: "rowanpaul",
	version: "1.0.0",
	scheme: "opnshelf",
	orientation: "portrait",
	icon: "./assets/images/icon.png",
	userInterfaceStyle: "automatic",
	updates: {
		url: "https://u.expo.dev/87d86952-59ab-4711-9f5f-f9477b2d14f6",
	},
	runtimeVersion: {
		policy: "appVersion",
	},
	ios: {
		supportsTablet: true,
		bundleIdentifier: "com.rowanpaul.opnshelf",
		// Required by @bacons/apple-targets to sign the widget extension target.
		appleTeamId: "FNW3B5Q58G",
		infoPlist: {
			ITSAppUsesNonExemptEncryption: false,
		},
		entitlements: {
			// The only channel between the app and the WidgetKit extension
			// (handle, theme, API origin — never a session token). Mirrored
			// onto the widget target by targets/widget/expo-target.config.js.
			"com.apple.security.application-groups": ["group.com.rowanpaul.opnshelf"],
		},
	},
	android: {
		adaptiveIcon: {
			foregroundImage: "./assets/images/adaptive-icon.png",
			backgroundColor: "#0f172a",
		},
		package: "com.rowanpaul.opnshelf",
		// expo-sensors merges ACTIVITY_RECOGNITION (pedometer) into the manifest;
		// Google Play classifies it as a health feature and rejects API submits.
		// We only use the accelerometer (shake-to-feedback), so block it.
		blockedPermissions: ["android.permission.ACTIVITY_RECOGNITION"],
	},
	web: {
		bundler: "metro",
		favicon: "./assets/images/favicon.png",
	},
	plugins: [
		"expo-router",
		"expo-secure-store",
		"expo-font",
		"expo-image",
		[
			"expo-splash-screen",
			{
				image: "./assets/images/splash-icon.png",
				resizeMode: "contain",
				backgroundColor: "#0f172a",
			},
		],
		[
			"expo-image-picker",
			{
				photosPermission:
					"Opnshelf needs access to your photos so you can set a profile picture.",
			},
		],
		// Links targets/widget (the WidgetKit Home-Screen Widget) into the
		// generated Xcode project — ios/ is prebuild output and never checked in.
		"@bacons/apple-targets",
	],
	experiments: {
		typedRoutes: true,
	},
	extra: {
		apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3001",
		posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
		posthogHost:
			process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
		turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY,
		pdsHandleDomain:
			process.env.EXPO_PUBLIC_PDS_HANDLE_DOMAIN ?? "opnshelf.social",
		siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? "https://opnshelf.xyz",
		eas: {
			projectId: "87d86952-59ab-4711-9f5f-f9477b2d14f6",
		},
	},
};

export default config;
