import {
	INTEGRATIONS,
	integrationBanner,
	integrationCatchUpMessage,
	integrationKey,
} from "@opnshelf/api";
import { useQueries } from "@tanstack/react-query";
import { Link } from "expo-router";
import { AlertTriangle } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
	SafeAreaInsetsContext,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/theme/colors";
/** Strip above the tabs for whichever Integration needs the User or is catching up. */
export function IntegrationSyncBanner({ children }: { children: ReactNode }) {
	const colors = useThemeColors();
	const insets = useSafeAreaInsets();
	const { isAuthenticated } = useAuth();
	// Shares each Integration's status cache, so Settings changes show up here at once.
	const statuses = useQueries({
		queries: INTEGRATIONS.map((integration) => ({
			queryKey: [...integrationKey(integration), "status"],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				integration.api.status(signal),
			enabled: isAuthenticated,
			refetchInterval: (query: {
				state: { data?: Awaited<ReturnType<typeof integration.api.status>> };
			}) =>
				query.state.data?.status === "active" ||
				integrationCatchUpMessage(query.state.data, integration.name)
					? 5000
					: (false as const),
		})),
	});
	const banner = isAuthenticated
		? integrationBanner(statuses.map((status) => status.data))
		: null;
	const syncMessage = banner?.message;
	const syncError = banner?.error;
	if (!syncMessage) return <>{children}</>;
	return (
		<View className="flex-1 bg-background">
			<Link
				href={{
					pathname: "/integrations/[provider]",
					params: { provider: banner?.integration.id ?? "trakt" },
				}}
				asChild
			>
				<Pressable
					className={`border-b px-4 pb-2 ${syncError ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" : "border-border bg-background-subtle"}`}
					style={{ paddingTop: insets.top }}
				>
					<View className="flex-row items-center gap-2">
						{syncError ? (
							<AlertTriangle color={colors.warning} size={17} />
						) : (
							<ActivityIndicator size="small" color={colors.accent} />
						)}
						<Text
							className={`flex-1 text-sm leading-5 ${syncError ? "text-amber-950 dark:text-amber-100" : "text-muted-foreground"}`}
						>
							{syncMessage}. View details.
						</Text>
					</View>
				</Pressable>
			</Link>
			<SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
				{children}
			</SafeAreaInsetsContext.Provider>
		</View>
	);
}
