import { Stack } from "expo-router";
import { useTheme } from "@/contexts/theme";

export default function ProfileLayout() {
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
			<Stack.Screen name="friends" />
			<Stack.Screen name="shelf" />
			<Stack.Screen name="lists" />
			<Stack.Screen name="up-next" />
			<Stack.Screen name="calendar" />
		</Stack>
	);
}
