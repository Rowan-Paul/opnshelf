import { ArrowLeft } from "lucide-react-native";
import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface ScrollRevealHeaderProps {
	title: string;
	visible: boolean;
	onBack: () => void;
}

function ScrollRevealHeaderComponent({
	title,
	visible,
	onBack,
}: ScrollRevealHeaderProps) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();

	if (!visible) {
		return null;
	}

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: colors.background,
					paddingTop: insets.top,
					borderBottomColor: colors.outline,
				},
			]}
		>
			<View style={styles.row}>
				<TouchableOpacity
					onPress={onBack}
					style={styles.backButton}
					hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
				>
					<ArrowLeft size={22} color={colors.onBackground} />
				</TouchableOpacity>
				<Text style={[styles.title, { color: colors.onBackground }]} numberOfLines={1}>
					{title}
				</Text>
			</View>
		</View>
	);
}

export const ScrollRevealHeader = memo(ScrollRevealHeaderComponent);

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 50,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.sm,
		gap: spacing.sm,
	},
	backButton: {
		padding: spacing.xs,
	},
	title: {
		fontSize: 16,
		fontWeight: "600",
		flex: 1,
	},
});
