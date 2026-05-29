import { View } from "react-native";
import { Text } from "@/components/ui/text";

/** Titled prose block for a media overview/synopsis. Renders nothing when empty. */
export function OverviewSection({
	title = "Overview",
	text,
}: {
	title?: string;
	text?: string;
}) {
	if (!text) return null;
	return (
		<View className="px-4">
			<Text className="mb-2 font-display font-semibold text-base text-foreground">
				{title}
			</Text>
			<Text className="text-muted-foreground text-sm leading-5">{text}</Text>
		</View>
	);
}
