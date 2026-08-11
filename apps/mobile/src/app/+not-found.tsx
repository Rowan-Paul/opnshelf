import { Stack, usePathname, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { env } from "@/lib/env";

/**
 * Catches an opnshelf.xyz link the app captured but has no screen for.
 *
 * Android App Links have no exclude rule, so the `/profile` prefix pulls in
 * `/profile/x/library` and `/profile/x/notes`, which exist only on the Web App
 * (ADR 0022). Without this the user lands on Expo Router's unmatched screen
 * having tapped a perfectly good link.
 *
 * It opens in a Custom Tab rather than handing the URL back to the system:
 * `Linking.openURL` on an https URL we are registered for would be captured by
 * this same app again, which is an infinite loop.
 */
export default function NotFound() {
	const pathname = usePathname();
	const router = useRouter();
	const handled = useRef(false);

	useEffect(() => {
		if (handled.current) return;
		handled.current = true;
		// Leave the dead route behind first, so Back does not return to it.
		router.replace("/");
		void openBrowserAsync(`${env.siteUrl}${pathname}`).catch(() => {});
	}, [pathname, router]);

	return (
		<View className="flex-1 items-center justify-center bg-background">
			<Stack.Screen options={{ headerShown: false }} />
			<ActivityIndicator />
		</View>
	);
}
