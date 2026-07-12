import "../global.css";

import {
	Inter_400Regular,
	Inter_400Regular_Italic,
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
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Providers } from "@/components/Providers";
import { initializeApiClient } from "@/lib/api";
import { posthog } from "@/lib/posthog";
import { useTheme } from "@/lib/theme-context";

SplashScreen.preventAutoHideAsync();

/** Manual screen tracking for Expo Router + PostHog. */
function useScreenTracking() {
	const pathname = usePathname();
	const screenSection = pathname.split("/")[1] || "home";
	const previous = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (previous.current !== screenSection) {
			posthog?.screen(screenSection, {
				previous_screen: previous.current ?? null,
			});
			previous.current = screenSection;
		}
	}, [screenSection]);
}

export default function RootLayout() {
	// Register fonts under the exact family names the design tokens reference
	// (`--font-sans: 'Inter'`, `--font-display: 'PlusJakartaSans'` in
	// global.css), plus weighted aliases for explicit use. RN can't synthesize
	// weights, so each weight is its own family.
	const [fontsLoaded] = useFonts({
		Inter: Inter_400Regular,
		"Inter-Italic": Inter_400Regular_Italic,
		"Inter-Medium": Inter_500Medium,
		"Inter-SemiBold": Inter_600SemiBold,
		"Inter-Bold": Inter_700Bold,
		PlusJakartaSans: PlusJakartaSans_500Medium,
		"PlusJakartaSans-SemiBold": PlusJakartaSans_600SemiBold,
		"PlusJakartaSans-Bold": PlusJakartaSans_700Bold,
	});

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
			<ScreenTracker />
			{/* Custom `header` replaces the platform-native header on every screen
			    with headerShown: true, so iOS and Android render the same bar. */}
			<Stack
				screenOptions={{
					headerShown: false,
					header: (props) => <AppHeader {...props} />,
				}}
			>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="login" />
				<Stack.Screen name="auth/complete" />
				<Stack.Screen name="signup" />
				<Stack.Screen name="verify-email" />
				<Stack.Screen name="onboarding" />
				<Stack.Screen name="settings" options={{ headerShown: true }} />
				<Stack.Screen name="edit-profile" options={{ headerShown: true }} />
				<Stack.Screen name="calendar" options={{ headerShown: true }} />
				<Stack.Screen name="lists/index" options={{ headerShown: true }} />
				<Stack.Screen name="lists/[slug]" options={{ headerShown: true }} />
				<Stack.Screen
					name="list/[handle]/[slug]"
					options={{ headerShown: true }}
				/>
				<Stack.Screen name="trakt-import" options={{ headerShown: true }} />
				<Stack.Screen name="profile/[handle]" options={{ headerShown: true }} />
				<Stack.Screen
					name="profile/[handle]/shelf"
					options={{ headerShown: true }}
				/>
				<Stack.Screen
					name="profile/[handle]/up-next"
					options={{ headerShown: true }}
				/>
				<Stack.Screen
					name="profile/[handle]/reviews"
					options={{ headerShown: true }}
				/>
				<Stack.Screen
					name="profile/[handle]/connections"
					options={{ headerShown: true }}
				/>
				<Stack.Screen name="movie/[id]" />
				<Stack.Screen name="person/[id]" />
				<Stack.Screen name="show/[id]/index" />
				<Stack.Screen name="show/[id]/season/[seasonNumber]/index" />
				<Stack.Screen name="show/[id]/season/[seasonNumber]/episode/[episodeNumber]/index" />
			</Stack>
			<ThemedStatusBar />
		</Providers>
	);
}

/** StatusBar style follows the effective theme scheme from the context. */
function ThemedStatusBar() {
	const { scheme } = useTheme();
	return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

function ScreenTracker() {
	useScreenTracking();
	return null;
}
