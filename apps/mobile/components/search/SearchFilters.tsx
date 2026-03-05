import { Pressable, StyleSheet, Text, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type SearchFiltersProps = {
	mediaType: "all" | "movies" | "shows";
	onChange: (mediaType: "all" | "movies" | "shows") => void;
};

export function SearchFilters({ mediaType, onChange }: SearchFiltersProps) {
	const { colors } = useTheme();

	return (
		<View style={styles.filterRow}>
			{(["all", "movies", "shows"] as const).map((tab) => (
				<Pressable
					key={tab}
					onPress={() => onChange(tab)}
					style={[
						styles.filterButton,
						{
							backgroundColor:
								mediaType === tab ? colors.primary : colors.surfaceContainer,
						},
					]}
				>
					<Text
						style={{
							color: mediaType === tab ? colors.onPrimary : colors.onSurface,
							fontWeight: "600",
							textTransform: "capitalize",
						}}
					>
						{tab}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	filterRow: {
		flexDirection: "row",
		gap: spacing.sm,
		marginHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	filterButton: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
	},
});
