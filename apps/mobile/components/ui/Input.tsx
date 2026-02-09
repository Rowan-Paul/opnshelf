import { StyleSheet, View, TextInput, type TextInputProps, ViewStyle } from "react-native";
import { colors, borderRadius, spacing } from "@/constants/theme";
import { Search } from "lucide-react-native";

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
}

export function SearchInput({ containerStyle, ...props }: SearchInputProps) {
	return (
		<Input
			icon={<Search size={20} color={colors.textMuted} />}
			containerStyle={containerStyle}
			{...props}
		/>
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
});
