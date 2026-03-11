import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
	StyleSheet,
	View,
	type LayoutChangeEvent,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { borderRadius } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface SkeletonProps {
	width?: number | `${number}%`;
	height?: number;
	borderRadius?: number;
	style?: StyleProp<ViewStyle>;
}

export function Skeleton({
	width = "100%",
	height = 16,
	borderRadius: br = borderRadius.md,
	style,
}: SkeletonProps) {
	const { colors } = useTheme();
	const shimmerProgress = useSharedValue(0);
	const [layoutWidth, setLayoutWidth] = useState(
		typeof width === "number" ? width : 0,
	);

	useEffect(() => {
		shimmerProgress.value = withRepeat(
			withTiming(1, {
				duration: 1250,
				easing: Easing.inOut(Easing.ease),
			}),
			-1,
			false,
		);
	}, [shimmerProgress]);

	const handleLayout = (event: LayoutChangeEvent) => {
		const nextWidth = event.nativeEvent.layout.width;
		if (nextWidth > 0 && nextWidth !== layoutWidth) {
			setLayoutWidth(nextWidth);
		}
	};

	const shimmerWidth = useMemo(() => {
		if (layoutWidth <= 0) {
			return 96;
		}

		return Math.max(layoutWidth * 0.45, 96);
	}, [layoutWidth]);

	const shimmerStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateX: interpolate(
					shimmerProgress.value,
					[0, 1],
					[-shimmerWidth, layoutWidth + shimmerWidth],
				),
			},
		],
	}));

	return (
		<View
			onLayout={handleLayout}
			style={[
				styles.skeleton,
				{
					width,
					height,
					borderRadius: br,
					backgroundColor: colors.surfaceContainerHighest,
					borderColor: withAlpha(colors.outlineVariant, 0.22),
				},
				style,
			]}
		>
			<View
				style={[
					styles.innerGlow,
					{
						borderRadius: br,
						backgroundColor: withAlpha(colors.onSurface, 0.03),
					},
				]}
			/>
			<AnimatedLinearGradient
				colors={[
					withAlpha(colors.onSurface, 0),
					withAlpha(colors.onSurface, 0.16),
					withAlpha(colors.onSurface, 0),
				]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={[
					styles.shimmer,
					{
						width: shimmerWidth,
						borderRadius: br,
					},
					shimmerStyle,
				]}
			/>
		</View>
	);
}

function withAlpha(hex: string, alpha: number): string {
	const normalized = hex.replace("#", "");
	if (normalized.length !== 6) {
		return hex;
	}

	const red = Number.parseInt(normalized.slice(0, 2), 16);
	const green = Number.parseInt(normalized.slice(2, 4), 16);
	const blue = Number.parseInt(normalized.slice(4, 6), 16);

	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const styles = StyleSheet.create({
	skeleton: {
		overflow: "hidden",
		borderWidth: StyleSheet.hairlineWidth,
		position: "relative",
	},
	innerGlow: {
		...StyleSheet.absoluteFillObject,
	},
	shimmer: {
		position: "absolute",
		top: 0,
		bottom: 0,
	},
});
