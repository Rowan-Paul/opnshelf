import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	withSpring,
} from "react-native-reanimated";
import { colors, borderRadius } from "@/constants/theme";

interface SwitchProps {
	value: boolean;
	onValueChange: (value: boolean) => void;
	disabled?: boolean;
}

export function Switch({ value, onValueChange, disabled = false }: SwitchProps) {
	const translateX = useAnimatedStyle(() => ({
		transform: [
			{
				translateX: withSpring(value ? 22 : 2, {
					damping: 15,
					stiffness: 120,
				}),
			},
		],
	}));

	return (
		<Pressable
			onPress={() => !disabled && onValueChange(!value)}
			disabled={disabled}
			style={[
				styles.container,
				value ? styles.containerActive : styles.containerInactive,
				disabled && styles.disabled,
			]}
		>
			<Animated.View style={[styles.thumb, translateX]} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: {
		width: 52,
		height: 28,
		borderRadius: borderRadius.full,
		justifyContent: "center",
		paddingHorizontal: 2,
	},
	containerActive: {
		backgroundColor: colors.warning,
	},
	containerInactive: {
		backgroundColor: colors.cardMuted,
	},
	disabled: {
		opacity: 0.5,
	},
	thumb: {
		width: 24,
		height: 24,
		borderRadius: borderRadius.full,
		backgroundColor: colors.text,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 2,
		elevation: 3,
	},
});
