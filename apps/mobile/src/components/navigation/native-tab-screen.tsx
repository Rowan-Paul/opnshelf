import { useSafeAreaInsets } from "react-native-safe-area-context";

export { ScreenFrame as NativeTabScreen } from "@/components/ui/screen-frame";

/** Apply clearance to scroll content, never to the scene viewport. */
export function useNativeTabContentPadding() {
	const { bottom } = useSafeAreaInsets();
	return 32 + (process.env.EXPO_OS === "ios" ? bottom : 0);
}
