import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, borderRadius } from "@/constants/theme";

interface SkeletonProps {
	width?: number | `${number}%`;
	height?: number;
	borderRadius?: number;
	style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, borderRadius: br = borderRadius.md, style }: SkeletonProps) {
	return (
		<View
			style={[
				styles.skeleton,
				{ width, height, borderRadius: br },
				style,
			]}
		/>
	);
}

const styles = StyleSheet.create({
	skeleton: {
		backgroundColor: colors.cardMuted,
	},
});
