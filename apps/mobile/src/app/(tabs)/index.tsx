import { View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";

export default function HomeScreen() {
	return (
		<Screen>
			<View className="flex-1 justify-center gap-2">
				<Text className="font-bold font-display text-3xl text-foreground">
					OpnShelf
				</Text>
				<Text className="text-base text-muted-foreground">
					Mobile rework foundation. Tokens, fonts, navigation and the API client
					are wired up.
				</Text>
				<View className="mt-4 self-start rounded-md bg-primary px-4 py-2">
					<Text className="font-sans font-semibold text-primary-foreground text-sm">
						Amber accent
					</Text>
				</View>
			</View>
		</Screen>
	);
}
