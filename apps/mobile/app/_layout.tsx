import { QueryClientProvider } from "@tanstack/react-query";
import {
	Stack,
	useGlobalSearchParams,
	usePathname,
	useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PostHogProvider } from "posthog-react-native";
import { useEffect, useRef, useState } from "react";
import { LogBox } from "react-native";
import { MD3DarkTheme, PaperProvider } from "react-native-paper";
import { DevToolsBubble } from "react-native-react-query-devtools";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/LoadingScreen";
import { M3SnackbarProvider } from "@/components/ui/m3/M3Snackbar";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { ThemeProvider } from "@/contexts/theme";
import { initializeApiClient } from "@/lib/api";
import { posthog } from "@/lib/posthog";
import { queryClient } from "@/lib/query-client";

if (__DEV__) {
	LogBox.ignoreLogs([
		"SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.",
	]);
}

function LocaleInitializer({ children }: { children: React.ReactNode }) {
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		async function setupLocale() {
			try {
				const { registerTranslation, en } = await import(
					"react-native-paper-dates"
				);
				registerTranslation("en", en);
				setIsReady(true);
			} catch (error) {
				console.error("Failed to initialize locale:", error);
			}
		}
		setupLocale();
	}, []);

	if (!isReady) {
		return null;
	}

	return <>{children}</>;
}

function AppContent() {
	const { isLoading } = useAuth();

	if (isLoading) {
		return <LoadingScreen message="Loading..." />;
	}

	return (
		<M3SnackbarProvider>
			<OnboardingGate />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: {
						backgroundColor: "#030712",
					},
				}}
			>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="movie/[id]" />
				<Stack.Screen name="show/[id]" />
				<Stack.Screen name="show/[id]/season/[seasonNumber]/index" />
				<Stack.Screen name="show/[id]/season/[seasonNumber]/episode/[episodeNumber]/index" />
				<Stack.Screen
					name="auth/callback"
					options={{ presentation: "modal" }}
				/>
				<Stack.Screen
					name="auth/complete"
					options={{ presentation: "modal" }}
				/>
				<Stack.Screen name="settings" />
				<Stack.Screen name="list/[slug]" />
				<Stack.Screen name="login" />
				<Stack.Screen name="onboarding" />
			</Stack>
			<StatusBar style="light" />
		</M3SnackbarProvider>
	);
}

function OnboardingGate() {
	const { user, isLoading, isAuthenticated } = useAuth();
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		if (isLoading || !user || !isAuthenticated) {
			return;
		}

		const isAuthRoute = pathname === "/login" || pathname.startsWith("/auth/");
		const isOnboardingRoute = pathname === "/onboarding";

		if (user.needsOnboarding && !isOnboardingRoute && !isAuthRoute) {
			router.replace("/onboarding");
			return;
		}

		if (!user.needsOnboarding && isOnboardingRoute) {
			router.replace("/(tabs)");
		}
	}, [isLoading, user, isAuthenticated, pathname, router]);

	return null;
}

function ScreenTracker() {
	const pathname = usePathname();
	const params = useGlobalSearchParams();
	const previousPathname = useRef<string | undefined>(undefined);

	// Manual screen tracking for Expo Router
	// @see https://docs.expo.dev/router/reference/screen-tracking/
	useEffect(() => {
		if (previousPathname.current !== pathname) {
			posthog.screen(pathname, {
				previous_screen: previousPathname.current ?? null,
				...params,
			});
			previousPathname.current = pathname;
		}
	}, [pathname, params]);

	return null;
}

export default function RootLayout() {
	useEffect(() => {
		initializeApiClient();
	}, []);

	return (
		<SafeAreaProvider>
			<PostHogProvider
				client={posthog}
				autocapture={{
					captureScreens: false, // Manual tracking with Expo Router
					captureTouches: true,
					propsToCapture: ["testID"],
					maxElementsCaptured: 20,
				}}
			>
				<QueryClientProvider client={queryClient}>
					<PaperProvider theme={MD3DarkTheme}>
						<ThemeProvider>
							<AuthProvider>
								<LocaleInitializer>
									<ScreenTracker />
									<AppContent />
								</LocaleInitializer>
							</AuthProvider>
						</ThemeProvider>
					</PaperProvider>
					{__DEV__ && <DevToolsBubble queryClient={queryClient} />}
				</QueryClientProvider>
			</PostHogProvider>
		</SafeAreaProvider>
	);
}
