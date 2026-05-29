import { Stack } from "expo-router";
import { View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";

export default function SettingsScreen() {
	return (
		<>
			<Stack.Screen options={{ title: "Settings" }} />
			<Screen>
				<View className="flex-1 justify-center">
					<Text className="text-base text-muted-foreground">
						Settings (stack route) — demonstrates the tabs + stack shell.
					</Text>
				</View>
			</Screen>
		</>
	);
}
