import { Stack } from "expo-router";
import { useTheme } from "@/contexts/theme";

export default function PublicUserLayout() {
	const { colors } = useTheme();

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: {
					backgroundColor: colors.background,
				},
			}}
		>
			<Stack.Screen name="index" />
			<Stack.Screen name="shelf" />
			<Stack.Screen name="lists" />
			<Stack.Screen name="up-next" />
			<Stack.Screen name="friends" />
			<Stack.Screen name="followers" />
			<Stack.Screen name="following" />
		</Stack>
	);
}
