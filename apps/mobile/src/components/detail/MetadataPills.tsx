import { View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Row of small rounded pills used under a detail hero for compact metadata
 * (year, runtime, season/episode counts, genres, rating). Falsy entries are
 * filtered out so callers can pass conditional values directly.
 */
export function MetadataPills({
	items,
}: {
	items: Array<string | undefined | false | null>;
}) {
	const pills = items.filter((i): i is string => Boolean(i));
	if (pills.length === 0) return null;

	return (
		<View className="flex-row flex-wrap gap-2">
			{pills.map((pill) => (
				<View
					key={pill}
					className="rounded-full bg-background-subtle px-3 py-1"
				>
					<Text className="text-muted-foreground text-xs">{pill}</Text>
				</View>
			))}
		</View>
	);
}
