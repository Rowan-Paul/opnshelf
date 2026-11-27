import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/theme/colors";

export interface PrevNextTarget {
	/** "Previous season", "Next episode". */
	label: string;
	/** The target's code, e.g. "S1" or "S1E2". */
	code: string;
	onPress: () => void;
}

/**
 * Previous/next paging between sibling seasons or episodes, for the stack
 * header's `headerRight` so it stays in one place however long the screen is.
 * Each side shows its target's code beside the chevron, which tells it apart
 * from the back button and says where the tap leads. A side with no neighbour
 * is left out rather than disabled. Mirrors the Web App's `PrevNextNav`.
 */
export function PrevNextNav({
	previous,
	next,
}: {
	previous?: PrevNextTarget;
	next?: PrevNextTarget;
}) {
	const colors = useThemeColors();
	if (!previous && !next) return null;

	return (
		<View className="-mr-2 flex-row gap-1">
			{[previous, next].map((target, index) => {
				if (!target) return null;
				const Icon = index === 0 ? ChevronLeft : ChevronRight;
				return (
					<Pressable
						key={target.label}
						accessibilityRole="button"
						accessibilityLabel={`${target.label}, ${target.code}`}
						onPress={target.onPress}
						className={`h-11 min-w-11 items-center justify-center gap-0.5 px-1 ${index === 0 ? "flex-row" : "flex-row-reverse"}`}
					>
						<Icon color={colors.mutedForeground} size={18} />
						<Text
							className="font-medium text-muted-foreground text-xs"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{target.code}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}
