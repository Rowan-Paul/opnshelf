import { StyleSheet, View, TextInput, TouchableOpacity, type TextInputProps, ViewStyle } from "react-native";
import { colors, borderRadius, spacing } from "@/constants/theme";
import { Search, X } from "lucide-react-native";

interface InputProps extends TextInputProps {
	icon?: React.ReactNode;
	containerStyle?: ViewStyle;
}

export function Input({ icon, containerStyle, style, ...props }: InputProps) {
	return (
		<View style={[styles.container, containerStyle]}>
			{icon ? <View style={styles.icon}>{icon}</View> : null}
			<TextInput
				style={[styles.input, icon ? styles.inputWithIcon : null, style]}
				placeholderTextColor={colors.textSecondary}
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
	const hasValue = value && value.toString().length > 0;
	return (
		<View style={[styles.container, containerStyle]}>
			<View style={styles.icon}>
				<Search size={20} color={colors.textMuted} />
			</View>
			<TextInput
				style={[styles.input, styles.inputWithIcon, hasValue ? styles.inputWithClear : null]}
				placeholderTextColor={colors.textSecondary}
				value={value}
				{...props}
			/>
			{hasValue && onClear && (
				<TouchableOpacity style={styles.clearButton} onPress={onClear}>
					<X size={20} color={colors.textMuted} />
				</TouchableOpacity>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.card,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.border,
	},
	icon: {
		paddingLeft: spacing.md,
	},
	input: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: spacing.md,
		color: colors.text,
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
