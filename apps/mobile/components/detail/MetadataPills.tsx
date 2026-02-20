import type { MetadataPill } from "./types";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface MetadataPillsProps {
	items: MetadataPill[];
}

export function MetadataPills({ items }: MetadataPillsProps) {
	const { colors } = useTheme();

	if (items.length === 0) {
		return null;
	}

	return (
		<View style={styles.container}>
			{items.map((item, index) => {
				const content = (
					<>
						{typeof item.icon === "object" && item.icon}
						<Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
							{item.label}
						</Text>
					</>
				);

				if (item.onPress) {
					return (
						<TouchableOpacity
							key={`${item.label}-${index}`}
							onPress={item.onPress}
							style={[
								styles.pill,
								{ borderColor: colors.outline },
							]}
							activeOpacity={0.7}
						>
							{content}
						</TouchableOpacity>
					);
				}

				return (
					<View
						key={`${item.label}-${index}`}
						style={[
							styles.pill,
							{ borderColor: colors.outline },
						]}
					>
						{content}
					</View>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		borderWidth: 1,
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.md,
		paddingVertical: 6,
	},
	label: {
		fontSize: 13,
		fontWeight: "500",
	},
});
