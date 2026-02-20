import type { ColorTheme, EpisodeSummary } from "./types";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface EpisodeNavProps {
	previousEpisode: EpisodeSummary | null;
	currentEpisode: EpisodeSummary;
	nextEpisode: EpisodeSummary | null;
	colors: ColorTheme;
	variant?: "sidebar" | "full";
	onPreviousPress?: () => void;
	onNextPress?: () => void;
}

function formatDateOnly(dateString?: string): string {
	if (!dateString) return "TBA";
	return new Date(dateString).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function EpisodeNav({
	previousEpisode,
	currentEpisode,
	nextEpisode,
	colors,
	variant = "full",
	onPreviousPress,
	onNextPress,
}: EpisodeNavProps) {
	const { colors: themeColors } = useTheme();
	const hasPrev = previousEpisode !== null;
	const hasNext = nextEpisode !== null;

	if (variant === "sidebar") {
		if (!hasPrev && !hasNext) {
			return null;
		}

		return (
			<View style={styles.sidebarContainer}>
				{hasPrev ? (
					<TouchableOpacity
						onPress={onPreviousPress}
						style={[styles.sidebarButton, { borderColor: themeColors.outline }]}
						activeOpacity={0.8}
					>
						<Ionicons name="arrow-back" size={16} color={themeColors.onSurfaceVariant} />
						<Text style={[styles.sidebarText, { color: themeColors.onSurfaceVariant }]}>
							Ep {previousEpisode!.episode_number}
						</Text>
					</TouchableOpacity>
				) : (
					<View style={styles.sidebarPlaceholder} />
				)}

				{hasNext ? (
					<TouchableOpacity
						onPress={onNextPress}
						style={[styles.sidebarButton, { borderColor: themeColors.outline }]}
						activeOpacity={0.8}
					>
						<Text style={[styles.sidebarText, { color: themeColors.onSurfaceVariant }]}>
							Ep {nextEpisode!.episode_number}
						</Text>
						<Ionicons name="arrow-forward" size={16} color={themeColors.onSurfaceVariant} />
					</TouchableOpacity>
				) : (
					<View style={styles.sidebarPlaceholder} />
				)}
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{[
				{
					key: "previous",
					label: "Previous Episode",
					icon: "arrow-back",
					episode: previousEpisode,
					highlighted: false,
					onPress: onPreviousPress,
				},
				{
					key: "current",
					label: "Current Episode",
					icon: "radio-button-on",
					episode: currentEpisode,
					highlighted: true,
					onPress: undefined,
				},
				{
					key: "next",
					label: "Next Episode",
					icon: "arrow-forward",
					episode: nextEpisode,
					highlighted: false,
					onPress: onNextPress,
				},
			].map((slot) => {
				if (!slot.episode) {
					return (
						<View
							key={slot.key}
							style={[
								styles.card,
								{ borderColor: themeColors.outline, opacity: 0.5 },
							]}
						>
							<View style={styles.cardHeader}>
								<Ionicons
									name={slot.icon as any}
									size={14}
									color={themeColors.onSurfaceVariant}
								/>
								<Text style={[styles.cardLabel, { color: themeColors.onSurfaceVariant }]}>
									{slot.label}
								</Text>
							</View>
							<Text style={[styles.cardEmpty, { color: themeColors.onSurfaceVariant }]}>
								No episode
							</Text>
						</View>
					);
				}

				const Content = (
					<View
						style={[
							styles.card,
							{
								borderColor: slot.highlighted ? colors.primary : themeColors.outline,
								backgroundColor: slot.highlighted ? `${colors.primary}15` : "transparent",
							},
						]}
					>
						<View style={styles.cardHeader}>
							<Ionicons
								name={slot.icon as any}
								size={14}
								color={themeColors.onSurfaceVariant}
							/>
							<Text style={[styles.cardLabel, { color: themeColors.onSurfaceVariant }]}>
								{slot.label}
							</Text>
						</View>
						<Text style={[styles.cardTitle, { color: themeColors.onSurface }]} numberOfLines={1}>
							E{slot.episode.episode_number}: {slot.episode.name}
						</Text>
						<Text style={[styles.cardDate, { color: themeColors.onSurfaceVariant }]}>
							{formatDateOnly(slot.episode.air_date)}
						</Text>
					</View>
				);

				if (slot.onPress) {
					return (
						<TouchableOpacity
							key={slot.key}
							onPress={slot.onPress}
							activeOpacity={0.8}
						>
							{Content}
						</TouchableOpacity>
					);
				}

				return <View key={slot.key}>{Content}</View>;
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		gap: spacing.sm,
	},
	card: {
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		padding: spacing.md,
		gap: 4,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	cardLabel: {
		fontSize: 11,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	cardTitle: {
		fontSize: 14,
		fontWeight: "600",
		marginTop: 4,
	},
	cardDate: {
		fontSize: 12,
	},
	cardEmpty: {
		fontSize: 13,
		fontStyle: "italic",
		marginTop: 4,
	},
	sidebarContainer: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	sidebarButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xs,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
	},
	sidebarText: {
		fontSize: 13,
		fontWeight: "500",
	},
	sidebarPlaceholder: {
		flex: 1,
	},
});
