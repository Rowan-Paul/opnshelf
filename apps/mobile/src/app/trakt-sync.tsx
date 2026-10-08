import { Stack, useLocalSearchParams } from "expo-router";
import { TraktSyncManager } from "@/components/trakt/TraktSyncManager";
import { EndReachedScrollView } from "@/lib/use-end-reached";

export default function TraktSyncScreen() {
	const { connection } = useLocalSearchParams<{ connection?: string }>();
	return (
		<EndReachedScrollView
			className="flex-1 bg-background"
			contentContainerClassName="px-4 py-4 pb-12"
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
		>
			<Stack.Screen options={{ headerShown: true, title: "Trakt Sync" }} />
			<TraktSyncManager connectionFailed={connection === "failed"} />
		</EndReachedScrollView>
	);
}
