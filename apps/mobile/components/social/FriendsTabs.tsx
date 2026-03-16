import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

export type FriendsTab = "following" | "followers";

const tabLabels: Record<FriendsTab, string> = {
	following: "Following",
	followers: "Followers",
};

export function FriendsTabs({
	activeTab,
	counts,
	onChange,
}: {
	activeTab: FriendsTab;
	counts: Record<FriendsTab, number>;
	onChange: (tab: FriendsTab) => void;
}) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: colors.surfaceContainer,
					borderColor: colors.outlineVariant,
				},
			]}
		>
			{(Object.keys(tabLabels) as FriendsTab[]).map((tab) => {
				const isActive = tab === activeTab;

				return (
					<TouchableOpacity
						key={tab}
						style={[
							styles.tab,
							{
								backgroundColor: isActive
									? colors.primaryContainer
									: "transparent",
							},
						]}
						onPress={() => onChange(tab)}
					>
						<Text
							style={[
								styles.tabLabel,
								{
									color: isActive
										? colors.onPrimaryContainer
										: colors.onSurfaceVariant,
								},
							]}
						>
							{tabLabels[tab]} ({counts[tab]})
						</Text>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.xs,
		borderWidth: 1,
		borderRadius: borderRadius.full,
		padding: spacing.xs,
	},
	tab: {
		flex: 1,
		minWidth: 120,
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	tabLabel: {
		fontSize: 14,
		fontWeight: "600",
		textAlign: "center",
	},
});
