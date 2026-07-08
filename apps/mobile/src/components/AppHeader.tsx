// expo-router vendors react-navigation and re-exports its types; there is no
// @react-navigation/native-stack package in this SDK.
import type { NativeStackHeaderProps } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";

/**
 * Custom stack header, set once as the root Stack's `header` option so every
 * screen with `headerShown: true` renders identically on iOS and Android —
 * the native headers differ per platform (centered chevron header vs Material
 * left-title arrow) and ignore the app theme. Screens keep using the standard
 * `title` / `headerLeft` / `headerRight` options; this component renders them.
 *
 * Title is left-aligned on both platforms: wide headerRight action clusters
 * (the list screen has up to four icons) would push a centered title
 * off-center.
 */
/** The header's back chevron, exported so screens overriding `headerLeft`
 * (e.g. to confirm discarding edits) render the exact same button. */
export function HeaderBackButton({ onPress }: { onPress: () => void }) {
	return (
		<Pressable hitSlop={8} onPress={onPress} className="-ml-2 p-1">
			<ChevronLeft color="#94a3b8" size={24} />
		</Pressable>
	);
}

export function AppHeader({
	navigation,
	route,
	options,
	back,
}: NativeStackHeaderProps) {
	const insets = useSafeAreaInsets();
	const canGoBack = back !== undefined;
	const left = options.headerLeft?.({ canGoBack });
	const right = options.headerRight?.({ canGoBack });

	return (
		<View
			className="border-border border-b bg-background"
			style={{ paddingTop: insets.top }}
		>
			<View className="h-12 flex-row items-center gap-3 px-4">
				{(left ?? canGoBack)
					? (left ?? <HeaderBackButton onPress={() => navigation.goBack()} />)
					: null}
				<Text
					numberOfLines={1}
					className="flex-1 font-display font-semibold text-foreground text-lg"
				>
					{options.title ?? route.name}
				</Text>
				{right}
			</View>
		</View>
	);
}
