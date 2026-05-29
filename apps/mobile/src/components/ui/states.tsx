import type { LucideIcon } from "lucide-react-native";
import { AlertTriangle, SearchX } from "lucide-react-native";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { Text } from "@/components/ui/text";
import { darkNavTheme, lightNavTheme } from "@/theme";

/** Centered spinner for full-screen loading states. */
export function LoadingState({ label }: { label?: string }) {
	const colorScheme = useColorScheme();
	const theme = colorScheme === "dark" ? darkNavTheme : lightNavTheme;
	return (
		<View className="flex-1 items-center justify-center gap-3 py-20">
			<ActivityIndicator size="large" color={theme.colors.primary} />
			{label ? <Text className="text-muted-foreground">{label}</Text> : null}
		</View>
	);
}

/** Full-screen error state with a message and optional retry affordance. */
export function ErrorState({
	title = "Something went wrong",
	message,
}: {
	title?: string;
	message?: string;
}) {
	return (
		<View className="flex-1 items-center justify-center gap-2 px-8 py-20">
			<AlertTriangle color="#ef4444" size={40} />
			<Text className="text-center font-display font-semibold text-lg">
				{title}
			</Text>
			{message ? (
				<Text className="text-center text-muted-foreground text-sm">
					{message}
				</Text>
			) : null}
		</View>
	);
}

/** Full-screen empty state with a customizable icon and copy. */
export function EmptyState({
	icon: Icon = SearchX,
	title,
	message,
}: {
	icon?: LucideIcon;
	title: string;
	message?: string;
}) {
	return (
		<View className="flex-1 items-center justify-center gap-2 px-8 py-20">
			<Icon color="#94a3b8" size={44} />
			<Text className="text-center font-display font-semibold text-lg">
				{title}
			</Text>
			{message ? (
				<Text className="text-center text-muted-foreground text-sm">
					{message}
				</Text>
			) : null}
		</View>
	);
}
