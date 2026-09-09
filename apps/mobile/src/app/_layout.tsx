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
import { AccountDeletionGate } from "@/components/AccountDeletionGate";
import { AppHeader } from "@/components/AppHeader";
import { Providers } from "@/components/Providers";
import { WelcomeTour } from "@/components/tour/WelcomeTour";
import { initializeApiClient } from "@/lib/api";
import { env } from "@/lib/env";
import { posthog } from "@/lib/posthog";
import { useTheme } from "@/lib/theme-context";
import { setWidgetApiUrl } from "../../modules/widget-bridge";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = { anchor: "(tabs)" };

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
		// The Home-Screen Widget fetches the public profile endpoint itself, so
		// it needs the build-time API origin handed over once at startup.
		setWidgetApiUrl(env.apiUrl);
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
				<Stack.Screen
					name="settings/preferences"
					options={{ headerShown: true }}
				/>
				<Stack.Screen
					name="settings/connections"
					options={{ headerShown: true }}
				/>
				<Stack.Screen name="settings/account" options={{ headerShown: true }} />
				<Stack.Screen name="settings/help" options={{ headerShown: true }} />
				<Stack.Screen name="edit-profile" options={{ headerShown: true }} />
				<Stack.Screen name="calendar" options={{ headerShown: true }} />
				<Stack.Screen name="lists/index" options={{ headerShown: true }} />
				<Stack.Screen name="lists/[slug]" options={{ headerShown: true }} />
				<Stack.Screen
					name="list/[handle]/[slug]"
					options={{ headerShown: true }}
				/>
				<Stack.Screen name="trakt-import" options={{ headerShown: true }} />
				<Stack.Screen
					name="atstore-review"
					options={{
						presentation: "formSheet",
						sheetAllowedDetents: [0.75, 1],
						sheetGrabberVisible: true,
						contentStyle: { backgroundColor: "transparent" },
					}}
				/>
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
				<Stack.Screen name="movies/[id]/[name]/index" />
				<Stack.Screen name="people/[id]/[name]" />
				<Stack.Screen name="shows/[id]/[name]/index" />
				<Stack.Screen name="shows/[id]/[name]/seasons/[seasonNumber]/index" />
				<Stack.Screen name="shows/[id]/[name]/seasons/[seasonNumber]/episodes/[episodeNumber]/index" />
			</Stack>
			<AccountDeletionGate />
			{/* Above the tabs: the tour walks the user across them and has to
			    survive each navigation (ADR 0024). */}
			<WelcomeTour />
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
