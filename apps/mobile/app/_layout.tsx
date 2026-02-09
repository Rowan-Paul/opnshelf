import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth";
import { initializeApiClient } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { colors } from "@/constants/theme";

export default function RootLayout() {
	useEffect(() => {
		initializeApiClient();
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
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
			</AuthProvider>
		</QueryClientProvider>
	);
}
