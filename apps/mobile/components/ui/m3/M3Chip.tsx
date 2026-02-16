import { Pressable, StyleSheet, View, Text, type PressableProps, type ViewStyle, type StyleProp } from "react-native";
import { useTheme } from "@/contexts/theme";
import { m3BorderRadius } from "@/constants/material-theme";

export type M3ChipVariant = "assist" | "filter" | "input" | "suggestion";
export type M3ChipShape = "circle" | "closable";

export interface M3ChipProps extends Omit<PressableProps, "style"> {
	variant?: M3ChipVariant;
	selected?: boolean;
	label: string;
	icon?: React.ReactNode;
	shape?: M3ChipShape;
	showLeadingIcon?: boolean;
	showTrailingIcon?: boolean;
	style?: StyleProp<ViewStyle>;
}

export function M3Chip({
	variant = "filter",
	selected = false,
	label,
	icon,
	shape,
	disabled,
	style,
	...props
}: M3ChipProps) {
	const { colors } = useTheme();

	const getBackgroundColor = (): string => {
		if (variant === "assist") {
			return selected ? colors.secondaryContainer : colors.surfaceContainerLow;
		}
		if (variant === "filter" || variant === "suggestion") {
			return selected ? colors.secondaryContainer : colors.surfaceContainerHigh;
		}
		return colors.surfaceContainerHigh;
	};

	const getTextColor = (): string => {
		if (variant === "assist" || (selected && (variant === "filter" || variant === "suggestion"))) {
			return colors.onSecondaryContainer;
		}
		return colors.onSurfaceVariant;
	};

	const getBorderColor = (): string | undefined => {
		if (variant === "assist" || variant === "suggestion") {
			return colors.outline;
		}
		if (variant === "filter" && !selected) {
			return colors.outline;
		}
		return undefined;
	};

	const chipStyles: ViewStyle = {
		backgroundColor: getBackgroundColor(),
		borderColor: getBorderColor(),
		borderWidth: variant === "assist" || variant === "suggestion" ? 1 : 0,
		...(disabled ? { opacity: 0.38 } : {}),
	};

	return (
		<Pressable
			style={[styles.chip, chipStyles, style]}
			disabled={disabled}
			{...props}
		>
			{icon && <View style={styles.iconContainer}>{icon}</View>}
			<Text style={[styles.label, { color: getTextColor() }]}>{label}</Text>
		</Pressable>
	);
}

export interface M3ChipGroupProps {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}

export function M3ChipGroup({ children, style }: M3ChipGroupProps) {
	return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
	chip: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: m3BorderRadius.small,
		minHeight: 32,
	},
	iconContainer: {
		marginRight: 8,
	},
	label: {
		fontSize: 14,
		fontWeight: "500",
	},
	group: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
});
