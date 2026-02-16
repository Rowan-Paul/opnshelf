import { useState } from "react";
import {
	StyleSheet,
	View,
	TextInput,
	Text,
	type TextInputProps,
	type ViewStyle,
	type StyleProp,
} from "react-native";
import { useTheme } from "@/contexts/theme";
import { m3BorderRadius } from "@/constants/material-theme";

export type M3TextFieldVariant = "outlined" | "filled";

export interface M3TextFieldProps extends TextInputProps {
	label?: string;
	helperText?: string;
	error?: string;
	variant?: M3TextFieldVariant;
	containerStyle?: StyleProp<ViewStyle>;
}

export function M3TextField({
	label,
	helperText,
	error,
	variant = "outlined",
	containerStyle,
	...props
}: M3TextFieldProps) {
	const { colors } = useTheme();
	const [isFocused, setIsFocused] = useState(false);

	const getBorderColor = () => {
		if (error) return colors.error;
		if (isFocused) return colors.primary;
		return colors.outline;
	};

	const getLabelColor = () => {
		if (error) return colors.error;
		if (isFocused) return colors.primary;
		return colors.onSurfaceVariant;
	};

	const getVariantStyles = (): ViewStyle => {
		switch (variant) {
			case "filled":
				return {
					backgroundColor: colors.surfaceContainerHighest,
					borderBottomWidth: 2,
					borderBottomColor: isFocused ? colors.primary : colors.outline,
					borderTopLeftRadius: m3BorderRadius.extraLarge,
					borderTopRightRadius: m3BorderRadius.extraLarge,
					borderBottomLeftRadius: 0,
					borderBottomRightRadius: 0,
				};
			case "outlined":
			default:
				return {
					backgroundColor: colors.surface,
					borderWidth: 1,
					borderColor: getBorderColor(),
					borderRadius: m3BorderRadius.extraSmall,
				};
		}
	};

	const getLabelPosition = () => {
		if (props.value || isFocused || props.placeholder) {
			return "top";
		}
		return "center";
	};

	return (
		<View style={[styles.container, containerStyle]}>
			{label && (
				<View
					style={[
						styles.labelContainer,
						getLabelPosition() === "top" ? styles.labelTop : styles.labelCenter,
					]}
				>
					<Text
						style={[
							styles.label,
							{
								color: getLabelColor(),
								fontSize: getLabelPosition() === "top" ? 12 : 16,
							},
						]}
					>
						{label}
					</Text>
				</View>
			)}
			<View style={[styles.inputContainer, getVariantStyles()]}>
				<TextInput
					{...props}
					style={[
						styles.input,
						{
							color: colors.onSurface,
						},
						props.style,
					]}
					placeholderTextColor={colors.onSurfaceVariant}
					onFocus={(e) => {
						setIsFocused(true);
						props.onFocus?.(e);
					}}
					onBlur={(e) => {
						setIsFocused(false);
						props.onBlur?.(e);
					}}
				/>
			</View>
			{(helperText || error) && (
				<View style={styles.helperContainer}>
					<Text
						style={[
							styles.helperText,
							{ color: error ? colors.error : colors.onSurfaceVariant },
						]}
					>
						{error || helperText}
					</Text>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: "100%",
	},
	labelContainer: {
		marginBottom: 4,
	},
	labelTop: {
		marginBottom: 4,
	},
	labelCenter: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: 16,
		justifyContent: "center",
	},
	label: {
		fontWeight: "500",
	},
	inputContainer: {
		minHeight: 56,
		justifyContent: "center",
	},
	input: {
		flex: 1,
		paddingHorizontal: 16,
		paddingVertical: 12,
		fontSize: 16,
	},
	helperContainer: {
		marginTop: 4,
		paddingHorizontal: 16,
	},
	helperText: {
		fontSize: 12,
	},
});
