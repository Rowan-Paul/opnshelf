import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/theme/colors";

export interface PrevNextTarget {
	/** "Previous season", "Next episode". */
	label: string;
	/** The target's code, e.g. "S1" or "S1E2". */
	code: string;
	onPress: () => void;
}

/**
 * Previous/next paging between sibling seasons or episodes. A side with no
 * neighbour is left out rather than disabled; an empty half holds its place so
 * the remaining button keeps to its own edge. Mirrors the Web App's
 * `PrevNextNav`.
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
		<View className="flex-row gap-2 px-4">
			{previous ? (
				<Button
					variant="secondary"
					className="flex-1"
					label={previous.label}
					description={previous.code}
					leading={<ChevronLeft color={colors.mutedForeground} size={18} />}
					onPress={previous.onPress}
				/>
			) : (
				<View className="flex-1" />
			)}
			{next ? (
				<Button
					variant="secondary"
					className="flex-1"
					label={next.label}
					description={next.code}
					trailing={<ChevronRight color={colors.mutedForeground} size={18} />}
					onPress={next.onPress}
				/>
			) : (
				<View className="flex-1" />
			)}
		</View>
	);
}
