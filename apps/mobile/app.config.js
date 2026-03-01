export default {
	expo: {
		name: "OpnShelf",
		slug: "opnshelf",
		version: "1.0.0",
		scheme: "opnshelf",
		orientation: "default",
		icon: "./assets/images/icon.png",
		userInterfaceStyle: "light",
		newArchEnabled: true,
		splash: {
			image: "./assets/images/splash-icon.png",
			resizeMode: "contain",
			backgroundColor: "#0f172a",
		},
		ios: {
			supportsTablet: true,
			bundleIdentifier: "com.rowanpaul.opnshelf",
			infoPlist: {
				ITSAppUsesNonExemptEncryption: false,
			},
		},
		android: {
			adaptiveIcon: {
				foregroundImage: "./assets/images/adaptive-icon.png",
				backgroundColor: "#0f172a",
			},
			edgeToEdgeEnabled: true,
			predictiveBackGestureEnabled: false,
			package: "com.rowanpaul.opnshelf",
		},
		web: {
			favicon: "./assets/images/favicon.png",
		},
		extra: {
			eas: {
				projectId: "87d86952-59ab-4711-9f5f-f9477b2d14f6",
			},
			posthogApiKey: process.env.POSTHOG_API_KEY,
			posthogHost:
				process.env.POSTHOG_HOST || "https://eu.i.posthog.com",
		},
		owner: "rowanpaul",
		plugins: ["@react-native-community/datetimepicker"],
	},
};
