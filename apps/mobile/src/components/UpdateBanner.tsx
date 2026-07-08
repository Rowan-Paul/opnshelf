import * as Updates from "expo-updates";
import { RefreshCw } from "lucide-react-native";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus, Pressable, View } from "react-native";
import {
	SafeAreaInsetsContext,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";

/** Minimum gap between foreground update checks, so backgrounding/foregrounding
 * repeatedly doesn't hammer the update server. */
const CHECK_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Wraps the tab surface with a slim banner announcing a downloaded OTA update,
 * mirroring TraktSyncBanner's structure: while the banner shows it consumes the
 * top safe-area inset and zeroes it for the wrapped subtree, so screen content
 * sits flush under the banner instead of double-gapped. Composes with
 * TraktSyncBanner — whichever banner is outermost consumes the inset once.
 *
 * Checks for an update on mount and whenever the app returns to the
 * foreground (debounced), fetches it silently in the background, and once
 * downloaded shows a "Update ready" bar with a Restart button that reloads
 * into the new bundle.
 *
 * `Updates.isEnabled` is false in dev and in Expo Go — there's no update
 * service configured there — so this component is a pass-through in both; it
 * only does anything in EAS builds using the `production` channel.
 */
export function UpdateBanner({ children }: { children: ReactNode }) {
	const insets = useSafeAreaInsets();
	const { isUpdatePending } = Updates.useUpdates();
	const lastCheckAtRef = useRef(0);

	const checkForUpdate = useCallback(async () => {
		if (!Updates.isEnabled) {
			return;
		}
		const now = Date.now();
		if (now - lastCheckAtRef.current < CHECK_COOLDOWN_MS) {
			return;
		}
		lastCheckAtRef.current = now;
		try {
			const result = await Updates.checkForUpdateAsync();
			if (result.isAvailable) {
				await Updates.fetchUpdateAsync();
			}
		} catch {
			// Transient network/server failures must never surface to the user —
			// the banner simply won't appear this cycle, and we'll try again on
			// the next foreground or the next app launch.
		}
	}, []);

	useEffect(() => {
		if (!Updates.isEnabled) {
			return;
		}
		void checkForUpdate();

		const subscription = AppState.addEventListener(
			"change",
			(state: AppStateStatus) => {
				if (state === "active") {
					void checkForUpdate();
				}
			},
		);
		return () => subscription.remove();
	}, [checkForUpdate]);

	if (!Updates.isEnabled || !isUpdatePending) {
		return <>{children}</>;
	}

	return (
		<View className="flex-1 bg-background">
			<View
				className="border-border border-b bg-background-subtle px-4 pb-2.5"
				style={{ paddingTop: insets.top + 6 }}
			>
				<View className="flex-row items-center gap-2.5">
					<RefreshCw color="#f3bc00" size={16} strokeWidth={2.5} />
					<Text className="flex-1 font-medium text-foreground text-sm">
						Update ready
					</Text>
					<Pressable
						onPress={() => void Updates.reloadAsync()}
						className="rounded-full bg-primary px-3.5 py-1.5"
					>
						<Text className="font-semibold text-[#3f2e00] text-sm">
							Restart
						</Text>
					</Pressable>
				</View>
			</View>
			{/* Drop the top inset for the wrapped screens — the banner already
			    consumed it — so their own paddingTop sits them flush, not gapped. */}
			<SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
				{children}
			</SafeAreaInsetsContext.Provider>
		</View>
	);
}
