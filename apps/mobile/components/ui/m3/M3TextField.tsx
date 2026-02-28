import { forwardRef, useState } from "react";
import {
	Pressable,
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
	leadingIcon?: React.ReactNode;
	trailingIcon?: React.ReactNode;
	onPressTrailingIcon?: () => void;
}

export const M3TextField = forwardRef<TextInput, M3TextFieldProps>(
	function M3TextField(
		{
			label,
			helperText,
			error,
			variant = "outlined",
			containerStyle,
			style,
			value,
			defaultValue,
			leadingIcon,
			trailingIcon,
			onPressTrailingIcon,
			...props
		},
		ref,
	) {
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

	const hasValue = value !== undefined
		? String(value).length > 0
		: defaultValue !== undefined
			? String(defaultValue).length > 0
			: false;
	const isLabelFloating = hasValue || isFocused || !!props.placeholder;

		return (
			<View style={[styles.container, containerStyle]}>
				<View style={[styles.inputContainer, getVariantStyles()]}>
					{label && (
						<View
							pointerEvents="none"
							style={[
								styles.labelContainer,
								isLabelFloating ? styles.labelTop : styles.labelCenter,
								variant === "outlined" && {
									backgroundColor: colors.surface,
								},
							]}
						>
							<Text
								style={[
									styles.label,
									{
										color: getLabelColor(),
										fontSize: isLabelFloating ? 12 : 16,
									},
								]}
							>
								{label}
							</Text>
						</View>
					)}
					{leadingIcon && (
						<View
							pointerEvents="none"
							style={[styles.iconContainer, styles.leadingIconContainer]}
						>
							{leadingIcon}
						</View>
					)}
					<TextInput
						ref={ref}
						{...props}
						value={value}
						defaultValue={defaultValue}
						style={[
							styles.input,
							!!leadingIcon && styles.inputWithLeadingIcon,
							!!trailingIcon && styles.inputWithTrailingIcon,
							{
								color: colors.onSurface,
							},
							style,
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
					{trailingIcon &&
						(onPressTrailingIcon ? (
							<Pressable
								onPress={onPressTrailingIcon}
								style={[styles.iconContainer, styles.trailingIconContainer]}
							>
								{trailingIcon}
							</Pressable>
						) : (
							<View
								pointerEvents="none"
								style={[styles.iconContainer, styles.trailingIconContainer]}
							>
								{trailingIcon}
							</View>
						))}
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
	},
);

const styles = StyleSheet.create({
	container: {
		alignSelf: "stretch",
		minWidth: 0,
	},
	labelContainer: {
		position: "absolute",
		left: 12,
		zIndex: 2,
		paddingHorizontal: 4,
	},
	labelTop: {
		top: 0,
		transform: [{ translateY: -8 }],
	},
	labelCenter: {
		top: "50%",
		transform: [{ translateY: -10 }],
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
	inputWithLeadingIcon: {
		paddingLeft: 48,
	},
	inputWithTrailingIcon: {
		paddingRight: 48,
	},
	iconContainer: {
		position: "absolute",
		top: 0,
		bottom: 0,
		justifyContent: "center",
	},
	leadingIconContainer: {
		left: 14,
	},
	trailingIconContainer: {
		right: 14,
	},
	helperContainer: {
		marginTop: 4,
		paddingHorizontal: 16,
	},
	helperText: {
		fontSize: 12,
	},
});
