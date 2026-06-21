import { View } from "react-native";
import { Text } from "@/components/ui/text";

export interface DetailItem {
	label: string;
	value?: string | number | null;
}

/**
 * Labeled key/value metadata card for detail screens (Director, Runtime,
 * Genres, …). Mirrors the web `DetailsCard` — a bordered card with right-aligned
 * values. Rows with an empty value are dropped; the card hides itself entirely
 * when nothing is left to show.
 */
export function DetailsCard({
	title = "Details",
	items,
}: {
	title?: string;
	items: DetailItem[];
}) {
	const rows = items.filter(
		(item) =>
			item.value !== undefined && item.value !== null && item.value !== "",
	);
	if (rows.length === 0) return null;

	return (
		<View className="px-4">
			<View className="gap-3 rounded-xl border border-border bg-card p-4">
				<Text className="font-display font-semibold text-base text-foreground">
					{title}
				</Text>
				<View className="gap-2.5">
					{rows.map((item) => (
						<View key={item.label} className="flex-row justify-between gap-4">
							<Text className="text-muted-foreground text-sm">
								{item.label}
							</Text>
							<Text className="flex-1 text-right font-medium text-foreground text-sm">
								{item.value}
							</Text>
						</View>
					))}
				</View>
			</View>
		</View>
	);
}
