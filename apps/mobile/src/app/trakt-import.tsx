import { Stack } from "expo-router";
import { ScrollView, View } from "react-native";
import { TraktImportPanel } from "@/components/trakt/TraktImportPanel";

export default function TraktImportScreen() {
	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: "Import from Trakt" }}
			/>
			<ScrollView
				className="flex-1"
				contentContainerClassName="gap-4 px-4 py-4 pb-12"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<TraktImportPanel />
			</ScrollView>
		</View>
	);
}
