import { useMemo } from "react";
import { StyleSheet, View, TextInput, TouchableOpacity, type TextInputProps, ViewStyle } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { Search, X } from "lucide-react-native";

interface InputProps extends TextInputProps {
	icon?: React.ReactNode;
	containerStyle?: ViewStyle;
}

export function Input({ icon, containerStyle, style, ...props }: InputProps) {
	const { colors } = useTheme();

	return (
		<View style={[styles.container, { backgroundColor: colors.surfaceContainer, borderColor: colors.outline }, containerStyle]}>
			{icon ? <View style={styles.icon}>{icon}</View> : null}
			<TextInput
				style={[styles.input, icon ? styles.inputWithIcon : undefined, { color: colors.onSurface }, style]}
				placeholderTextColor={colors.onSurfaceVariant}
				{...props}
			/>
		</View>
	);
}

interface SearchInputProps extends Omit<TextInputProps, "icon"> {
	containerStyle?: ViewStyle;
	onClear?: () => void;
}

export function SearchInput({ containerStyle, onClear, value, ...props }: SearchInputProps) {
	const { colors } = useTheme();
	const hasValue = value && value.toString().length > 0;

	const containerStyles = useMemo(
		() => [
			styles.container,
			{ backgroundColor: colors.surfaceContainer, borderColor: colors.outline },
			containerStyle,
		],
		[colors.surfaceContainer, colors.outline, containerStyle],
	);

	const inputStyles = useMemo(
		() => [
			styles.input,
			styles.inputWithIcon,
			{ color: colors.onSurface, placeholderTextColor: colors.onSurfaceVariant },
			hasValue ? styles.inputWithClear : null,
		],
		[colors.onSurface, colors.onSurfaceVariant, hasValue],
	);

	return (
		<View style={containerStyles}>
			<View style={styles.icon}>
				<Search size={20} color={colors.onSurfaceVariant} />
			</View>
			<TextInput style={inputStyles} value={value} {...props} />
			{hasValue && onClear && (
				<TouchableOpacity style={styles.clearButton} onPress={onClear}>
					<X size={20} color={colors.onSurfaceVariant} />
				</TouchableOpacity>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: borderRadius.lg,
		borderWidth: 1,
	},
	icon: {
		paddingLeft: spacing.md,
	},
	input: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: spacing.md,
		fontSize: 16,
	},
	inputWithIcon: {
		paddingLeft: spacing.sm,
	},
	inputWithClear: {
		paddingRight: spacing.sm,
	},
	clearButton: {
		padding: spacing.sm,
		paddingRight: spacing.md,
	},
});
