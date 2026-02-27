import { useMemo } from "react";
import { StyleSheet, View, type TextInputProps, type ViewStyle } from "react-native";
import { Search, X } from "lucide-react-native";
import { M3TextField } from "@/components/ui/m3";
import { useTheme } from "@/contexts/theme";

interface InputProps extends TextInputProps {
	icon?: React.ReactNode;
	containerStyle?: ViewStyle;
}

export function Input({ icon, containerStyle, style, ...props }: InputProps) {
	return (
		<M3TextField
			{...props}
			style={style}
			variant="outlined"
			leadingIcon={icon}
			containerStyle={containerStyle}
		/>
	);
}

interface SearchInputProps extends Omit<TextInputProps, "icon"> {
	containerStyle?: ViewStyle;
	onClear?: () => void;
	label?: string;
}

export function SearchInput({ containerStyle, onClear, value, ...props }: SearchInputProps) {
	const { colors } = useTheme();
	const hasValue = value != null && value.toString().length > 0;

	const trailingIcon = useMemo(
		() =>
			hasValue && onClear ? (
				<View style={styles.clearIcon}>
					<X size={20} color={colors.onSurfaceVariant} />
				</View>
			) : undefined,
		[colors.onSurfaceVariant, hasValue, onClear],
	);

	return (
		<M3TextField
			{...props}
			value={value}
			label={props.label ?? "Search"}
			variant="outlined"
			containerStyle={containerStyle}
			leadingIcon={<Search size={20} color={colors.onSurfaceVariant} />}
			trailingIcon={trailingIcon}
			onPressTrailingIcon={hasValue && onClear ? onClear : undefined}
		/>
	);
}

const styles = StyleSheet.create({
	clearIcon: {
		alignItems: "center",
		justifyContent: "center",
	},
});
