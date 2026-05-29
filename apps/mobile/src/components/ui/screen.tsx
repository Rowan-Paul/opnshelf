import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";

/**
 * Screen container: themed background + top safe-area padding. Uniwind doesn't
 * support the `*-safe` utility classes, so we apply the inset via a style prop
 * (per the react-native-reusables Uniwind integration guidance).
 */
export function Screen({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const insets = useSafeAreaInsets();
	return (
		<View
			className={cn("flex-1 bg-background px-4", className)}
			style={{ paddingTop: insets.top }}
		>
			{children}
		</View>
	);
}
