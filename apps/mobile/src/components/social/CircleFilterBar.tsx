import type { CircleDto } from "@opnshelf/api";
import { Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/**
 * Horizontal pill row for filtering the activity feed by circle. "All" (no
 * circle) is always first. Hidden by the parent when the viewer has no circles.
 */
export function CircleFilterBar({
	circles,
	activeCircleId,
	onSelect,
}: {
	circles: CircleDto[];
	activeCircleId?: string;
	onSelect: (circleId?: string) => void;
}) {
	const pill = (
		label: string,
		active: boolean,
		onPress: () => void,
		key: string,
	) => (
		<Pressable
			key={key}
			onPress={onPress}
			className={cn(
				"rounded-full px-3 py-1.5",
				active ? "bg-primary" : "bg-background-subtle",
			)}
		>
			<Text
				className={cn(
					"font-medium text-sm",
					active ? "text-primary-foreground" : "text-muted-foreground",
				)}
				numberOfLines={1}
			>
				{label}
			</Text>
		</Pressable>
	);

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerClassName="gap-2 px-4 pb-3"
		>
			{pill("All", !activeCircleId, () => onSelect(undefined), "all")}
			{circles.map((circle) =>
				pill(
					circle.name,
					activeCircleId === circle.id,
					() => onSelect(circle.id),
					circle.id,
				),
			)}
		</ScrollView>
	);
}
