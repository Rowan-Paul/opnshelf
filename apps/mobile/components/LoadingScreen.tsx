import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withRepeat,
	withTiming,
	Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface LoadingScreenProps {
	message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
	const { colors } = useTheme();
	const pulse = useSharedValue(1);

	useEffect(() => {
		pulse.value = withRepeat(
			withTiming(1.2, {
				duration: 1500,
				easing: Easing.inOut(Easing.ease),
			}),
			-1,
			true
		);
	}, [pulse]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: pulse.value }],
	}));

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Animated.View style={[styles.logoContainer, animatedStyle]}>
				<Ionicons name="film" size={64} color={colors.primary} />
			</Animated.View>
			<ActivityIndicator
				size="large"
				color={colors.primary}
				style={styles.spinner}
			/>
			<Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{message}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.lg,
	},
	logoContainer: {
		marginBottom: spacing.lg,
	},
	spinner: {
		marginVertical: spacing.md,
	},
	message: {
		fontSize: 16,
		fontWeight: "500",
	},
});
