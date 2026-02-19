import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";

import { DevToolsBubble } from "react-native-react-query-devtools";
import { LoadingScreen } from "@/components/LoadingScreen";
import { M3SnackbarProvider } from "@/components/ui/m3/M3Snackbar";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { ThemeProvider } from "@/contexts/theme";
import { initializeApiClient } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

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
			</Stack>
			<StatusBar style="light" />
		</M3SnackbarProvider>
	);
}

export default function RootLayout() {
	useEffect(() => {
		initializeApiClient();
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<AuthProvider>
					<LocaleInitializer>
						<AppContent />
					</LocaleInitializer>
				</AuthProvider>
			</ThemeProvider>
			<DevToolsBubble queryClient={queryClient} />
		</QueryClientProvider>
	);
}
