import { StyleSheet, Text, View } from "react-native";
import { spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type OverviewSectionProps = {
	titleColor?: string;
	content: string;
};

export function OverviewSection({ titleColor, content }: OverviewSectionProps) {
	const { colors } = useTheme();

	if (!content) {
		return null;
	}

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: titleColor ?? colors.primary }]}>
				Overview
			</Text>
			<Text style={[styles.overview, { color: colors.onSurfaceVariant }]}>
				{content}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		gap: spacing.sm,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	overview: {
		fontSize: 15,
		lineHeight: 22,
	},
});
