import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NavThemeProvider } from "expo-router";
import { PostHogProvider } from "posthog-react-native";
import type { ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth-context";
import { FeedbackProvider } from "@/lib/feedback";
import { posthog } from "@/lib/posthog";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { darkNavTheme, lightNavTheme } from "@/theme";

/**
 * Navigation theme driven by the effective scheme from the app theme context,
 * so the navigator chrome (headers, tab bar) follows the manual override too.
 */
function ThemedNavigationProvider({ children }: { children: ReactNode }) {
	const { scheme } = useTheme();
	const navTheme = scheme === "dark" ? darkNavTheme : lightNavTheme;
	return <NavThemeProvider value={navTheme}>{children}</NavThemeProvider>;
}

/**
 * App-wide providers. Order matters: gesture root -> keyboard controller ->
 * safe area -> analytics -> query -> theme (Uniwind + nav). Screen tracking is
 * handled manually in the root layout (Expo Router), so PostHog autocapture of
 * screens is disabled.
 */
export function Providers({ children }: { children: ReactNode }) {
	const inner = (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<ThemeProvider>
					<ThemedNavigationProvider>
						<ToastProvider>
							<FeedbackProvider>{children}</FeedbackProvider>
						</ToastProvider>
					</ThemedNavigationProvider>
				</ThemeProvider>
			</AuthProvider>
		</QueryClientProvider>
	);

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<KeyboardProvider>
				<SafeAreaProvider>
					{posthog ? (
						<PostHogProvider
							client={posthog}
							autocapture={{
								captureScreens: false,
								captureTouches: true,
							}}
						>
							{inner}
						</PostHogProvider>
					) : (
						inner
					)}
				</SafeAreaProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
