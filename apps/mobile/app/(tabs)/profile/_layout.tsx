import { Stack } from "expo-router";
import { colors } from "@/constants/theme";

export default function ProfileLayout() {
	return (
		<Stack
			screenOptions={{
				headerStyle: {
					backgroundColor: colors.background,
				},
				headerTintColor: colors.text,
				contentStyle: {
					backgroundColor: colors.background,
				},
			}}
		>
			<Stack.Screen
				name="index"
				options={{
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="shelf"
				options={{
					title: "My Shelf",
					headerShown: true,
				}}
			/>
			<Stack.Screen
				name="lists"
				options={{
					title: "My Lists",
					headerShown: true,
				}}
			/>
		</Stack>
	);
}
