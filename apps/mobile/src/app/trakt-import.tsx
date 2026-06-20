import { Stack } from "expo-router";
import { ScrollView } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { TraktImportPanel } from "@/components/trakt/TraktImportPanel";
import { useTwStyle } from "@/lib/use-tw-style";

export default function TraktImportScreen() {
	const containerStyle = useTwStyle("flex-1 bg-background");
	return (
		<KeyboardAvoidingView behavior="padding" style={containerStyle}>
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
		</KeyboardAvoidingView>
	);
}
