import { View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";

export default function SearchScreen() {
	return (
		<Screen>
			<View className="flex-1 justify-center">
				<Text className="font-display font-semibold text-2xl">Search</Text>
				<Text className="mt-1 text-muted-foreground">Coming soon.</Text>
			</View>
		</Screen>
	);
}
