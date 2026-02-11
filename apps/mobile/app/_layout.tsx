import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { ToastProvider } from "@/contexts/toast";
import { initializeApiClient } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { colors } from "@/constants/theme";
import { LoadingScreen } from "@/components/LoadingScreen";

function AppContent() {
	const { isLoading } = useAuth();

	if (isLoading) {
		return <LoadingScreen message="Loading..." />;
	}

	return (
		<ToastProvider>
			<Stack
				screenOptions={{
					headerStyle: {
						backgroundColor: colors.background,
					},
					headerTintColor: colors.text,
					headerTitleStyle: {
						color: colors.text,
					},
					contentStyle: {
						backgroundColor: colors.background,
					},
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen
					name="movie/[id]"
					options={{
						title: "Movie Details",
						headerTransparent: true,
						headerTintColor: colors.text,
					}}
				/>
				<Stack.Screen
					name="auth/callback"
					options={{
						presentation: "modal",
						headerShown: false,
					}}
				/>
			</Stack>
			<StatusBar style="light" />
		</ToastProvider>
	);
}

export default function RootLayout() {
	useEffect(() => {
		initializeApiClient();
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<AppContent />
			</AuthProvider>
		</QueryClientProvider>
	);
}
