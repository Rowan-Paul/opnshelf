import { createContext, type ReactNode, useContext } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Framed = createContext(false);

/** Reserve horizontal system/navigation space for every page state. */
export function ScreenFrame({
	children,
	style,
}: {
	children: ReactNode;
	style?: ViewProps["style"];
}) {
	const framed = useContext(Framed);
	if (framed)
		return (
			<View className="flex-1 bg-background" style={style}>
				{children}
			</View>
		);
	return (
		<View className="flex-1 bg-background" style={style}>
			<SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
				<Framed value={true}>{children}</Framed>
			</SafeAreaView>
		</View>
	);
}
