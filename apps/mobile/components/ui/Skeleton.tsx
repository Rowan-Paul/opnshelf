import { StyleSheet, View, type ViewStyle } from "react-native";
import { borderRadius } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface SkeletonProps {
	width?: number | `${number}%`;
	height?: number;
	borderRadius?: number;
	style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, borderRadius: br = borderRadius.md, style }: SkeletonProps) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.skeleton,
				{ width, height, borderRadius: br, backgroundColor: colors.surfaceContainerHigh },
				style,
			]}
		/>
	);
}

const styles = StyleSheet.create({
	skeleton: {},
});
