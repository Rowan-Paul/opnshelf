import type { IntegrationId } from "@opnshelf/api";
import { Image } from "expo-image";
import { View } from "react-native";
import { TraktMark } from "@/components/marks/TraktMark";
import { Text } from "@/components/ui/text";

/**
 * Each provider keeps its own logo. Popfeed publishes no brand kit; its mark is
 * the avatar of its official @popfeed.social account, shown unaltered. Same
 * choice as the Web App's `IntegrationMark`.
 */
export function IntegrationMark({
	id,
	size = 44,
}: {
	id: IntegrationId;
	size?: number;
}) {
	if (id === "trakt") return <TraktMark size={size} />;
	if (id === "bingers")
		return (
			<View
				accessible={false}
				className="items-center justify-center rounded-xl bg-muted"
				style={{ width: size, height: size }}
			>
				<Text className="font-bold" style={{ fontSize: size * 0.5 }}>
					B
				</Text>
			</View>
		);
	return (
		<Image
			source={require("../../../assets/images/popfeed.png")}
			accessible={false}
			style={{ width: size, height: size, borderRadius: size * 0.22 }}
		/>
	);
}
