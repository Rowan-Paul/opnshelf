import {
	INTEGRATIONS,
	integrationKey,
	integrationStatusLabel,
} from "@opnshelf/api";
import { useQueries } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { IntegrationMark } from "@/components/integrations/IntegrationMark";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/theme/colors";

export function IntegrationsSection() {
	const colors = useThemeColors();
	const statuses = useQueries({
		queries: INTEGRATIONS.map((integration) => ({
			queryKey: [...integrationKey(integration), "status"],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				integration.api.status(signal),
		})),
	});
	return (
		<View className="overflow-hidden rounded-xl border border-border bg-card">
			{INTEGRATIONS.map((integration, index) => {
				const status = statuses[index];
				return (
					<Link
						key={integration.id}
						href={{
							pathname: "/integrations/[provider]",
							params: { provider: integration.id },
						}}
						asChild
					>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`${integration.name}, ${status.data ? integrationStatusLabel(status.data) : "loading"}`}
							className={`flex-row items-center gap-3 p-4 active:bg-background-subtle ${index > 0 ? "border-border border-t" : ""}`}
						>
							<IntegrationMark id={integration.id} size={28} />
							<View className="flex-1 gap-1">
								<Text className="font-medium text-foreground">
									{integration.name}
								</Text>
								{status.data ? (
									<Text className="text-muted-foreground text-sm">
										{integrationStatusLabel(status.data)}
									</Text>
								) : status.isPending ? (
									<View className="h-4 w-24 animate-pulse rounded bg-background" />
								) : null}
								<Text className="text-muted-foreground text-sm leading-5">
									{integration.summary}
								</Text>
							</View>
							<ChevronRight color={colors.mutedForeground} size={18} />
						</Pressable>
					</Link>
				);
			})}
		</View>
	);
}
