import * as Updates from "expo-updates";
import { RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";

/** Minimum gap between foreground update checks, so backgrounding/foregrounding
 * repeatedly doesn't hammer the update server. */
const CHECK_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Slim, site-wide banner announcing a downloaded OTA update, mirroring
 * TraktSyncBanner's placement and styling — mounted alongside it in the
 * `(tabs)` layout so it shows across every tab.
 *
 * Checks for an update on mount and whenever the app returns to the
 * foreground (debounced), fetches it silently in the background, and once
 * downloaded shows a "Update ready" bar with a Restart button that reloads
 * into the new bundle.
 *
 * `Updates.isEnabled` is false in dev and in Expo Go — there's no update
 * service configured there — so this component is a no-op in both; it only
 * does anything in EAS builds using the `production` channel.
 */
export function UpdateBanner() {
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
		return null;
	}

	return (
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
					<Text className="font-semibold text-[#3f2e00] text-sm">Restart</Text>
				</Pressable>
			</View>
		</View>
	);
}
