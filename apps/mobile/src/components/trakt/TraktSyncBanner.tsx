import {
	traktSyncCatchUpMessage,
	traktSyncControllerStatus,
	traktSyncErrorMessage,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
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
export function TraktSyncBanner({ children }: { children: ReactNode }) {
	const colors = useThemeColors();
	const insets = useSafeAreaInsets();
	const { isAuthenticated } = useAuth();
	// Shares Trakt Sync's status cache, so Settings changes show up here at once.
	const { data: sync } = useQuery({
		queryKey: ["trakt-sync", "status"],
		queryFn: async ({ signal }) =>
			(await traktSyncControllerStatus({ signal, throwOnError: true })).data,
		enabled: isAuthenticated,
		refetchInterval: (query) =>
			query.state.data?.status === "active" ||
			traktSyncCatchUpMessage(query.state.data)
				? 5000
				: false,
	});
	const syncMessage = isAuthenticated ? traktSyncCatchUpMessage(sync) : null;
	const syncError = traktSyncErrorMessage(sync);
	if (!syncMessage) return <>{children}</>;
	return (
		<View className="flex-1 bg-background">
			<Link href="/trakt-sync" asChild>
				<Pressable
					className={`border-b px-4 pb-2 ${syncError ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" : "border-border bg-background-subtle"}`}
					style={{ paddingTop: insets.top }}
				>
					<View className="flex-row items-center gap-2">
						{syncError ? (
							<AlertTriangle color="#d97706" size={17} />
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
