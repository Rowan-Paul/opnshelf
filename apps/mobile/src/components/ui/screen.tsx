import type { ReactNode } from "react";
import { View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Screen container: themed background + top safe-area padding. Uniwind doesn't
 * support the `*-safe` utility classes, so we apply the inset via a style prop
 * (per the react-native-reusables Uniwind integration guidance).
 *
 * Wraps content in a cross-platform `KeyboardAvoidingView` (from
 * react-native-keyboard-controller) so a focused input is never hidden behind
 * the keyboard — the body shrinks and each screen's own scroll container can
 * bring the field into view. Pass `keyboardAvoiding={false}` for screens that
 * supply their own keyboard handling, to avoid double-nesting.
 */
export function Screen({
	children,
	className,
	keyboardAvoiding = true,
}: {
	children: ReactNode;
	className?: string;
	keyboardAvoiding?: boolean;
}) {
	const insets = useSafeAreaInsets();
	// Uniwind's `className` only works on RN-core components; the keyboard
	// controller's KeyboardAvoidingView is third-party, so resolve the classes
	// to a style object for it (see use-tw-style).
	const twStyle = useTwStyle(cn("flex-1 bg-background px-4", className));

	if (!keyboardAvoiding) {
		return (
			<View
				className={cn("flex-1 bg-background px-4", className)}
				style={{ paddingTop: insets.top }}
			>
				{children}
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			behavior="padding"
			style={[twStyle, { paddingTop: insets.top }]}
		>
			{children}
		</KeyboardAvoidingView>
	);
}
