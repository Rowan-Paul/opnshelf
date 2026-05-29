import "../global.css";

import {
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
	PlusJakartaSans_500Medium,
	PlusJakartaSans_600SemiBold,
	PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";
import { Stack, useGlobalSearchParams, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { useColorScheme } from "react-native";
import { Uniwind } from "uniwind";
import { Providers } from "@/components/Providers";
import { initializeApiClient } from "@/lib/api";
import { posthog } from "@/lib/posthog";

SplashScreen.preventAutoHideAsync();

/** Keep Uniwind's active theme in sync with the OS color scheme. */
function useUniwindColorScheme() {
	const colorScheme = useColorScheme();
	useEffect(() => {
		Uniwind.setTheme(colorScheme === "dark" ? "dark" : "light");
	}, [colorScheme]);
}

/** Manual screen tracking for Expo Router + PostHog. */
function useScreenTracking() {
	const pathname = usePathname();
	const params = useGlobalSearchParams();
	const previous = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (previous.current !== pathname) {
			posthog.screen(pathname, {
				previous_screen: previous.current ?? null,
				...params,
			});
			previous.current = pathname;
		}
	}, [pathname, params]);
}

export default function RootLayout() {
	// Register fonts under the exact family names the design tokens reference
	// (`--font-sans: 'Inter'`, `--font-display: 'PlusJakartaSans'` in
	// global.css), plus weighted aliases for explicit use. RN can't synthesize
	// weights, so each weight is its own family.
	const [fontsLoaded] = useFonts({
		Inter: Inter_400Regular,
		"Inter-Medium": Inter_500Medium,
		"Inter-SemiBold": Inter_600SemiBold,
		"Inter-Bold": Inter_700Bold,
		PlusJakartaSans: PlusJakartaSans_500Medium,
		"PlusJakartaSans-SemiBold": PlusJakartaSans_600SemiBold,
		"PlusJakartaSans-Bold": PlusJakartaSans_700Bold,
	});

	const colorScheme = useColorScheme();

	useEffect(() => {
		initializeApiClient();
	}, []);

	useEffect(() => {
		if (fontsLoaded) {
			SplashScreen.hideAsync();
		}
	}, [fontsLoaded]);

	if (!fontsLoaded) {
		return null;
	}

	return (
		<Providers>
			<ThemeSync />
			<ScreenTracker />
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="settings" options={{ headerShown: true }} />
			</Stack>
			<StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
		</Providers>
	);
}

function ThemeSync() {
	useUniwindColorScheme();
	return null;
}

function ScreenTracker() {
	useScreenTracking();
	return null;
}
