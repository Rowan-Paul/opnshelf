import { Stack } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { TraktImportManager } from "@/components/trakt/TraktImportManager";
import { EndReachedScrollView } from "@/lib/use-end-reached";
import { useTwStyle } from "@/lib/use-tw-style";

export default function TraktImportScreen() {
	const containerStyle = useTwStyle("flex-1 bg-background");
	return (
		<KeyboardAvoidingView behavior="padding" style={containerStyle}>
			<Stack.Screen
				options={{ headerShown: true, title: "Import from Trakt" }}
			/>
			<EndReachedScrollView
				className="flex-1"
				contentContainerClassName="gap-4 px-4 py-4 pb-12"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<TraktImportManager />
			</EndReachedScrollView>
		</KeyboardAvoidingView>
	);
}
