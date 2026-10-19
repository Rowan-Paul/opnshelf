import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Native iOS tabs overlay their scenes; their nested provider includes the bar. */
export function NativeTabScreen({
	children,
	style,
}: {
	children: ReactNode;
	style?: ViewProps["style"];
}) {
	const { bottom } = useSafeAreaInsets();
	return (
		<View
			className="flex-1 bg-background"
			style={[
				{ paddingBottom: process.env.EXPO_OS === "ios" ? bottom : 0 },
				style,
			]}
		>
			{children}
		</View>
	);
}
