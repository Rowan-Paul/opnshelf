import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "expo-router";
import { PostHogProvider } from "posthog-react-native";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth-context";
import { posthog } from "@/lib/posthog";
import { queryClient } from "@/lib/query-client";
import { darkNavTheme, lightNavTheme } from "@/theme";

/**
 * App-wide providers. Order matters: gesture root -> safe area -> analytics ->
 * query -> navigation theme. Screen tracking is handled manually in the root
 * layout (Expo Router), so PostHog autocapture of screens is disabled.
 */
export function Providers({ children }: { children: ReactNode }) {
	const colorScheme = useColorScheme();
	const navTheme = colorScheme === "dark" ? darkNavTheme : lightNavTheme;

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<PostHogProvider
					client={posthog}
					autocapture={{
						captureScreens: false,
						captureTouches: true,
					}}
				>
					<QueryClientProvider client={queryClient}>
						<AuthProvider>
							<ThemeProvider value={navTheme}>{children}</ThemeProvider>
						</AuthProvider>
					</QueryClientProvider>
				</PostHogProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
