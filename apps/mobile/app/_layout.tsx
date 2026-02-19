import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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
					headerStyle: {
						backgroundColor: "#030712",
					},
					headerTintColor: "#f9fafb",
					headerTitleStyle: {
						color: "#f9fafb",
					},
					contentStyle: {
						backgroundColor: "#030712",
					},
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen
					name="movie/[id]"
					options={{
						title: "Movie Details",
						headerTransparent: true,
						headerTintColor: "#f9fafb",
					}}
				/>
				<Stack.Screen
					name="show/[id]"
					options={{
						title: "Show Details",
						headerTransparent: true,
						headerTintColor: "#f9fafb",
					}}
				/>
				<Stack.Screen
					name="show/[id]/season/[seasonNumber]/index"
					options={{
						title: "Season",
						headerShown: true,
					}}
				/>
				<Stack.Screen
					name="show/[id]/season/[seasonNumber]/episode/[episodeNumber]/index"
					options={{
						title: "Episode",
						headerShown: true,
					}}
				/>
				<Stack.Screen
					name="auth/callback"
					options={{
						presentation: "modal",
						headerShown: false,
					}}
				/>
				<Stack.Screen
					name="auth/complete"
					options={{
						presentation: "modal",
						headerShown: false,
					}}
				/>
				<Stack.Screen
					name="settings"
					options={{
						title: "Settings",
						headerShown: true,
					}}
				/>
				<Stack.Screen
					name="list/[slug]"
					options={{
						headerShown: false,
					}}
				/>
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
		</QueryClientProvider>
	);
}
