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
import { colors, spacing } from "@/constants/theme";

interface LoadingScreenProps {
	message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
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
		<View style={styles.container}>
			<Animated.View style={[styles.logoContainer, animatedStyle]}>
				<Ionicons name="film" size={64} color={colors.primary} />
			</Animated.View>
			<ActivityIndicator
				size="large"
				color={colors.primary}
				style={styles.spinner}
			/>
			<Text style={styles.message}>{message}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
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
		color: colors.textMuted,
		fontSize: 16,
		fontWeight: "500",
	},
});
