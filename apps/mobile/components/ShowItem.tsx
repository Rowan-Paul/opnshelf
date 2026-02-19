import { useMemo } from "react";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { getTmdbPosterUrl } from "@/lib/utils";

export type ShowItemData = {
	id: number | string;
	name: string;
	poster_path?: string | null;
	posterPath?: string | null;
	first_air_date?: string | null;
	firstAirDate?: string | null;
};

interface ShowItemProps {
	show: ShowItemData;
	onPress: () => void;
	metaText?: string;
}

export function ShowItem({ show, onPress, metaText }: ShowItemProps) {
	const { colors } = useTheme();
	const posterUrl = getTmdbPosterUrl(
		show.poster_path ?? show.posterPath ?? null,
	);
	const firstAirDate = show.first_air_date ?? show.firstAirDate ?? null;
	const year = firstAirDate ? firstAirDate.split("-")[0] : undefined;

	const styles = useMemo(
		() =>
			StyleSheet.create({
				showItem: {
					flex: 1,
					marginBottom: spacing.lg,
					marginHorizontal: spacing.sm,
					minWidth: 140,
					maxWidth: "47%",
				},
				posterContainer: {
					aspectRatio: 2 / 3,
					borderRadius: borderRadius.lg,
					overflow: "hidden",
					backgroundColor: colors.surfaceContainer,
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 4 },
					shadowOpacity: 0.3,
					shadowRadius: 8,
					elevation: 8,
				},
				poster: {
					width: "100%",
					height: "100%",
				},
				noPoster: {
					justifyContent: "center",
					alignItems: "center",
					backgroundColor: colors.surfaceContainerHigh,
				},
				noPosterText: {
					color: colors.onSurfaceVariant,
					fontSize: 12,
					fontWeight: "500",
				},
				titleContainer: {
					marginTop: spacing.sm,
					minHeight: 40,
				},
				showTitle: {
					fontSize: 15,
					fontWeight: "600",
					color: colors.onSurface,
					letterSpacing: -0.2,
					lineHeight: 20,
					flexWrap: "wrap",
				},
				showYear: {
					marginTop: spacing.xs,
					fontSize: 12,
					color: colors.onSurfaceVariant,
					fontWeight: "500",
					letterSpacing: 0.5,
				},
			}),
		[
			colors.surfaceContainer,
			colors.surfaceContainerHigh,
			colors.onSurfaceVariant,
			colors.onSurface,
		],
	);

	return (
		<View style={styles.showItem}>
			<Pressable onPress={onPress} style={styles.posterContainer}>
				{posterUrl ? (
					<Image
						source={{ uri: posterUrl }}
						style={styles.poster}
						contentFit="cover"
						transition={200}
					/>
				) : (
					<View style={[styles.poster, styles.noPoster]}>
						<Text style={styles.noPosterText}>No poster</Text>
					</View>
				)}
			</Pressable>
			<Pressable onPress={onPress} style={styles.titleContainer}>
				<Text style={styles.showTitle} numberOfLines={2}>
					{show.name}
				</Text>
				{metaText ? <Text style={styles.showYear}>{metaText}</Text> : null}
				{!metaText && year ? <Text style={styles.showYear}>{year}</Text> : null}
			</Pressable>
		</View>
	);
}
