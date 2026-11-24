import { createContext, useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export { ScreenFrame as NativeTabScreen } from "@/components/ui/screen-frame";

/** Height of whatever floats over the tab scenes above the tab bar (the
 * Now Watching dock), so scroll content can clear it too. */
export const TabOverlayHeightContext = createContext(0);

/** Apply clearance to scroll content, never to the scene viewport. */
export function useNativeTabContentPadding() {
	const { bottom } = useSafeAreaInsets();
	const overlay = useContext(TabOverlayHeightContext);
	return 32 + overlay + (process.env.EXPO_OS === "ios" ? bottom : 0);
}
