import { type Href, Link } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { AlertTriangle, SearchX } from "lucide-react-native";
import {
	ActivityIndicator,
	Pressable,
	useColorScheme,
	View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { darkNavTheme, lightNavTheme } from "@/theme";
import { useThemeColors } from "@/theme/colors";

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
	onRetry,
}: {
	title?: string;
	message?: string;
	onRetry?: () => void;
}) {
	const themeColors = useThemeColors();
	return (
		<View className="flex-1 items-center justify-center gap-2 px-8 py-20">
			<AlertTriangle color={themeColors.destructive} size={40} />
			{title ? (
				<Text className="text-center font-display-semibold text-lg">
					{title}
				</Text>
			) : null}
			{message ? (
				<Text className="text-center text-muted-foreground text-sm">
					{message}
				</Text>
			) : null}
			{onRetry ? (
				<Pressable
					onPress={onRetry}
					className="mt-2 rounded-lg border border-border px-4 py-2.5"
				>
					<Text className="font-semibold text-primary text-sm">Try again</Text>
				</Pressable>
			) : null}
		</View>
	);
}

/**
 * A refetch that failed on top of data already on screen. React Query keeps the
 * last value, so the content is still good; this says the refresh did not land
 * and leaves it alone. Web shows the same strip above the same content.
 */
export function StaleDataNotice({
	message,
	onRetry,
	isRetrying,
}: {
	message: string;
	onRetry?: () => void;
	isRetrying?: boolean;
}) {
	const themeColors = useThemeColors();
	return (
		<View className="mx-3 mt-3 flex-row items-center gap-2 rounded-lg border border-border bg-background-subtle px-3 py-2">
			<AlertTriangle color={themeColors.destructive} size={16} />
			<Text className="flex-1 text-muted-foreground text-xs">{message}</Text>
			{onRetry ? (
				<Pressable
					accessibilityRole="button"
					disabled={isRetrying}
					hitSlop={6}
					onPress={onRetry}
				>
					<Text className="font-semibold text-primary text-xs">
						{isRetrying ? "Retrying…" : "Retry"}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

/**
 * Empty state with a customizable icon and copy, plus an optional link out.
 *
 * `screen` (default) fills an otherwise empty screen. `card` is the in-section
 * form for Home and other mixed screens, matching the Web App's `card p-8`
 * empty states: a bordered card with a primary action instead of a tall gap.
 */
export function EmptyState({
	icon: Icon = SearchX,
	title,
	message,
	action,
	variant = "screen",
}: {
	icon?: LucideIcon;
	title?: string;
	message?: string;
	action?: { label: string; href: Href; icon?: LucideIcon };
	variant?: "screen" | "card";
}) {
	const themeColors = useThemeColors();
	if (variant === "card") {
		const ActionIcon = action?.icon;
		return (
			<View className="items-center gap-2 rounded-xl border border-border bg-card p-6">
				<Icon color={themeColors.mutedForeground} size={40} />
				{title ? (
					<Text className="text-center font-display-semibold text-base">
						{title}
					</Text>
				) : null}
				{message ? (
					<Text className="text-center text-muted-foreground text-sm">
						{message}
					</Text>
				) : null}
				{action ? (
					<Link href={action.href} asChild>
						<Button
							label={action.label}
							size="sm"
							className="mt-2"
							leading={
								ActionIcon ? (
									<ActionIcon color="#3f2e00" size={16} />
								) : undefined
							}
						/>
					</Link>
				) : null}
			</View>
		);
	}
	return (
		<View className="flex-1 items-center justify-center gap-2 px-8 py-20">
			<Icon color={themeColors.mutedForeground} size={44} />
			<Text className="text-center font-display-semibold text-lg">{title}</Text>
			{message ? (
				<Text className="text-center text-muted-foreground text-sm">
					{message}
				</Text>
			) : null}
			{action ? (
				<Link href={action.href} asChild>
					<Pressable className="mt-2 rounded-lg border border-border px-4 py-2.5">
						<Text className="font-semibold text-primary text-sm">
							{action.label}
						</Text>
					</Pressable>
				</Link>
			) : null}
		</View>
	);
}
