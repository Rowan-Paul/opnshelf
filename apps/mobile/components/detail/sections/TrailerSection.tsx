import {
	getYouTubeThumbnailUrl,
	resolveDetailTrailer,
	type TmdbTrailerDto,
} from "@opnshelf/api";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type TrailerSectionProps = {
	mediaType: "movie" | "show" | "season" | "episode";
	detailTrailer?: TmdbTrailerDto;
	showTrailer?: TmdbTrailerDto;
	titleColor?: string;
	onPress: (trailer: TmdbTrailerDto) => void;
};

export function TrailerSection({
	mediaType,
	detailTrailer,
	showTrailer,
	titleColor,
	onPress,
}: TrailerSectionProps) {
	const { colors } = useTheme();
	const resolvedTrailer = resolveDetailTrailer({
		mediaType,
		detailTrailer,
		showTrailer,
	});

	if (!resolvedTrailer) {
		return null;
	}

	const { trailer, isFallback } = resolvedTrailer;

	return (
		<View style={styles.section}>
			<View style={styles.header}>
				<Text style={[styles.sectionTitle, { color: titleColor ?? colors.primary }]}>
					Trailer
				</Text>
				{isFallback ? (
					<View
						style={[
							styles.badge,
							{
								backgroundColor: colors.surfaceContainer,
								borderColor: colors.outlineVariant,
							},
						]}
					>
						<Text style={[styles.badgeText, { color: colors.onSurfaceVariant }]}>
							From show
						</Text>
					</View>
				) : null}
			</View>

			<Pressable
				onPress={() => onPress(trailer)}
				style={({ pressed }) => [
					styles.card,
					{
						backgroundColor: colors.surfaceContainerLow,
						borderColor: colors.outlineVariant,
						opacity: pressed ? 0.92 : 1,
					},
				]}
			>
				<Image
					source={{ uri: getYouTubeThumbnailUrl(trailer.key) }}
					style={styles.thumbnail}
					contentFit="cover"
				/>
				<View style={styles.overlay} />
				<View style={styles.content}>
					<View style={styles.copy}>
						<Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
							Watch trailer
						</Text>
						<Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
							{trailer.name}
						</Text>
					</View>
					<View
						style={[
							styles.playButton,
							{ backgroundColor: "rgba(0,0,0,0.55)", borderColor: colors.outline },
						]}
					>
						<Ionicons name="play" size={26} color="#fff" style={styles.playIcon} />
					</View>
				</View>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		gap: spacing.sm,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
	},
	badge: {
		borderRadius: borderRadius.full,
		borderWidth: 1,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: "600",
	},
	card: {
		aspectRatio: 16 / 9,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		overflow: "hidden",
		position: "relative",
	},
	thumbnail: {
		...StyleSheet.absoluteFillObject,
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.34)",
	},
	content: {
		...StyleSheet.absoluteFillObject,
		alignItems: "flex-end",
		flexDirection: "row",
		justifyContent: "space-between",
		padding: spacing.md,
	},
	copy: {
		flex: 1,
		gap: spacing.xs,
		paddingRight: spacing.sm,
	},
	eyebrow: {
		fontSize: 10,
		fontWeight: "600",
		letterSpacing: 0.8,
		textTransform: "uppercase",
	},
	title: {
		fontSize: 16,
		fontWeight: "600",
	},
	playButton: {
		alignItems: "center",
		borderRadius: borderRadius.full,
		borderWidth: 1,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	playIcon: {
		marginLeft: 2,
	},
});
