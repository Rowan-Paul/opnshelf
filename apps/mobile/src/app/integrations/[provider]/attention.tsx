import { findIntegration } from "@opnshelf/api";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { IntegrationSyncManager } from "@/components/integrations/IntegrationSyncManager";
import { EndReachedScrollView } from "@/lib/use-end-reached";

export default function IntegrationAttentionScreen() {
	const { provider } = useLocalSearchParams<{ provider: string }>();
	const integration = findIntegration(provider);
	if (!integration) return <Redirect href="/settings/integrations" />;
	return (
		<EndReachedScrollView
			className="flex-1 bg-background"
			contentContainerClassName="px-4 py-4 pb-12"
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
		>
			<Stack.Screen
				options={{ headerShown: true, title: "Review sync items" }}
			/>
			<IntegrationSyncManager
				key={integration.id}
				integration={integration}
				issuesOnly
			/>
		</EndReachedScrollView>
	);
}
