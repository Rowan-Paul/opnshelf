import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { Markdown } from "@/components/ui/Markdown";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Clipped markdown preview for profile review cards. Mirrors web: clamp the
 * body to a few lines and fade its bottom edge into the card colour so the
 * cutoff reads as "there's more" instead of an ugly mid-line slice. The card
 * itself links through to the full review, so no separate "read more" is needed.
 */
export function ReviewExcerpt({
	markdown,
	className = "max-h-24",
}: {
	markdown: string;
	className?: string;
}) {
	const cardColor =
		(useTwStyle("bg-card").backgroundColor as string | undefined) ?? "#0f172a";

	return (
		<View className={`relative overflow-hidden ${className}`}>
			<Markdown value={markdown} />
			<LinearGradient
				colors={["transparent", cardColor]}
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					bottom: 0,
					height: 28,
				}}
				pointerEvents="none"
			/>
		</View>
	);
}
