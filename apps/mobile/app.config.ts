import type { ExpoConfig } from "expo/config";

/**
 * Expo config. Secrets (PostHog key/host, API URL) are read from the
 * environment at build time and surfaced via `extra` so the running app can
 * read them through `expo-constants`. Never hardcode keys here.
 */
/**
 * Host the app registers for App Links and Universal Links.
 *
 * Taken from the same variable that already picks the site (`extra.siteUrl`),
 * so a `preview` build registers staging.opnshelf.xyz and a `production` build
 * registers opnshelf.xyz. The association files have to be reachable on the
 * host the binary claims, and each environment serves its own copy.
 */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://opnshelf.xyz";
const SITE_HOST = new URL(SITE_URL).host;

/**
 * Native Google sign-in, included only when there is an iOS client id to build
 * it from. The plugin throws without an `iosUrlScheme`, so registering it
 * unconditionally would break `expo prebuild` on any checkout that has not set
 * the Google variables — and Google is optional by design: unset hides the
 * button, matching the backend's own `configured` check.
 *
 * The scheme is the iOS client id reversed, which is a pure rewrite of it:
 * `<id>.apps.googleusercontent.com` -> `com.googleusercontent.apps.<id>`.
 * Deriving it beats carrying a second variable that must agree with the first.
 */
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleSignInPlugin = GOOGLE_IOS_CLIENT_ID
	? ([
			"@react-native-google-signin/google-signin",
			{
				iosUrlScheme: `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace(
					/\.apps\.googleusercontent\.com$/,
					"",
				)}`,
			},
		] as [string, Record<string, string>])
	: null;

const config: ExpoConfig = {
	name: "Opnshelf",
	slug: "opnshelf",
	owner: "rowanpaul",
	version: "1.4.0",
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
		// Universal Links (ADR 0022). Which paths open in the app is decided by
		// the host's apple-app-site-association, not here, so keep the two in
		// step. Adding this needs the Associated Domains capability, so the next
		// build regenerates the provisioning profile.
		associatedDomains: [`applinks:${SITE_HOST}`],
		// Required by @bacons/apple-targets to sign the widget extension target.
		appleTeamId: "FNW3B5Q58G",
		// Native Sign in with Apple (ADR 0027). Adds the
		// com.apple.developer.applesignin entitlement, so the next build
		// regenerates the provisioning profile - this cannot ship as an OTA
		// update. The Service ID used by the browser flow must have this App ID
		// as its primary app, or the two produce different Apple subjects and one
		// person ends up with two accounts.
		usesAppleSignIn: true,
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
		// App Links (ADR 0022). Only the prefixes whose routes the app actually
		// serves, matching the web's URL shapes (ADR 0023). Android has no
		// exclude rule, so /profile/*/library and /profile/*/notes get captured
		// even though there is no screen for them; +not-found hands those back
		// to the browser. Verification needs the SHA-256 fingerprints in
		// apps/web/public/.well-known/assetlinks.json to match the Play signing
		// key, and it fails silently when they do not.
		intentFilters: [
			{
				action: "VIEW",
				autoVerify: true,
				category: ["BROWSABLE", "DEFAULT"],
				data: [
					{ scheme: "https", host: SITE_HOST, pathPrefix: "/movies" },
					{ scheme: "https", host: SITE_HOST, pathPrefix: "/shows" },
					{ scheme: "https", host: SITE_HOST, pathPrefix: "/people" },
					{ scheme: "https", host: SITE_HOST, pathPrefix: "/reviews" },
					{ scheme: "https", host: SITE_HOST, pathPrefix: "/profile" },
				],
			},
		],
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
		...(googleSignInPlugin ? [googleSignInPlugin] : []),
		// Expo leaves R8 off, so a release bundle shipped 51 MB of unminified DEX
		// and Play scored its App optimization "Low" (1% obfuscation, no shrink).
		// Turning R8 and resource shrinking on is what lifts that score; each
		// native library ships its own consumer keep rules, so no extra ProGuard
		// rules are needed until a release build proves otherwise (RELEASING.md,
		// "Gotchas"). Native config: needs a store build, not an OTA update.
		[
			"expo-build-properties",
			{
				android: {
					enableMinifyInReleaseBuilds: true,
					enableShrinkResourcesInReleaseBuilds: true,
				},
			},
		],
		// R8 needs more Gradle daemon memory than Expo's template allows; the
		// plugin explains why it cannot go through expo-build-properties.
		"./plugins/with-gradle-jvm-args",
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
		// Hooks the native bundle step so each build uploads its Hermes source
		// maps to PostHog, turning minified exception frames back into TypeScript
		// (RELEASE.md, "Source maps"). The upload reads POSTHOG_CLI_* from the
		// build environment and fails the build when they are missing, so
		// profiles without credentials set POSTHOG_CLI_DRY_RUN=true in eas.json.
		// Native dSYM upload stays off: the exception reports (ADR 0031) are JS.
		"posthog-react-native/expo",
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
		// The *web* Google client id, passed to the native SDK as its
		// serverClientId so the id_token it returns is addressed to the client
		// the PDS validates against. Public, not a secret.
		googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
		// The iOS Google client id the native SDK needs for its own sake. It
		// never appears in a token audience. Public, not a secret.
		googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
		eas: {
			projectId: "87d86952-59ab-4711-9f5f-f9477b2d14f6",
		},
	},
};

export default config;
