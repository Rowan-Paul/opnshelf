import { Check } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * The gold "watched" pill: a bare check for a single Watch, a check plus the
 * total for rewatches. Non-interactive — poster cards that let you toggle the
 * shelf state render their own pressable with the same shape.
 *
 * Shared by every read-only surface that states a Watch count (poster cards,
 * the Watch history sheet) so the same number can't drift into looking like
 * two different things. Mirrors the Web `WatchCountBadge`.
 */
export function WatchCountBadge({
	watchCount,
	className,
}: {
	/** Viewer-relative Watches. Undefined means "watched", count unknown. */
	watchCount?: number;
	/** Sizing + positioning for the surface this sits on. */
	className?: string;
}) {
	const showCount = !!watchCount && watchCount > 1;
	return (
		<View
			className={`items-center justify-center rounded-full bg-primary ${
				showCount ? "flex-row gap-1 px-2" : ""
			} ${className ?? ""}`}
			accessibilityLabel={
				watchCount
					? `${watchCount} ${watchCount === 1 ? "watch" : "watches"} logged`
					: "Watched"
			}
		>
			<Check color="#3f2e00" size={16} strokeWidth={3} />
			{showCount ? (
				<Text
					className="font-bold text-[#3f2e00] text-xs"
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{watchCount}
				</Text>
			) : null}
		</View>
	);
}
