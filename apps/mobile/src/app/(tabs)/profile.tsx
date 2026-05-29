import { Link } from "expo-router";
import { View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";

export default function ProfileScreen() {
	return (
		<Screen>
			<View className="flex-1 justify-center gap-3">
				<Text className="font-display font-semibold text-2xl">Profile</Text>
				<Link href="/settings" className="font-medium text-accent text-base">
					Open settings
				</Link>
			</View>
		</Screen>
	);
}
