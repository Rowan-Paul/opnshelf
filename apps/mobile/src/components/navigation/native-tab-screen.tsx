import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Keep scenes full-height so scrolling content can pass behind the glass bar. */
export function NativeTabScreen({
	children,
	style,
}: {
	children: ReactNode;
	style?: ViewProps["style"];
}) {
	return (
		<View className="flex-1 bg-background" style={style}>
			{children}
		</View>
	);
}

/** Apply clearance to scroll content, never to the scene viewport. */
export function useNativeTabContentPadding() {
	const { bottom } = useSafeAreaInsets();
	return 32 + (process.env.EXPO_OS === "ios" ? bottom : 0);
}
