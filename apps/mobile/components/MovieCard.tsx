import type { TrackedMovieDto } from "@opnshelf/api";
import { CheckCircle2, Trash2 } from "lucide-react-native";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { getTmdbPosterUrl } from "@/lib/utils";
import { SpinningLoader } from "./SpinningLoader";

interface MovieCardProps {
	tracked: TrackedMovieDto;
	isRemoving: boolean;
	onRemove: (movieId: string) => void;
	onPress: () => void;
	timezone: string;
	is24Hour: boolean;
}

export function MovieCard({
	tracked,
	isRemoving,
	onRemove,
	onPress,
	timezone,
	is24Hour,
}: MovieCardProps) {
	const { colors } = useTheme();
	const formattedWatchedDate = tracked.watchedDate
		? new Date(tracked.watchedDate).toLocaleString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hour12: !is24Hour,
				timeZone: timezone,
			})
		: null;

	const posterUrl = getTmdbPosterUrl(tracked.movie.posterPath);

	return (
		<TouchableOpacity onPress={onPress} style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outline }]} activeOpacity={0.8}>
			<View style={[styles.posterContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
				{posterUrl ? (
					<Image
						source={{ uri: posterUrl }}
						style={styles.poster}
						contentFit="cover"
						transition={200}
					/>
				) : (
					<View style={[styles.poster, styles.noPoster, { backgroundColor: colors.surfaceContainerHigh }]}>
						<Text style={[styles.noPosterText, { color: colors.onSurfaceVariant }]}>No poster</Text>
					</View>
				)}
			</View>

			<View style={styles.cardContent}>
				<View style={styles.info}>
					<Text style={[styles.movieTitle, { color: colors.onSurface }]} numberOfLines={2}>
						{tracked.movie.title}
					</Text>
					<View style={styles.meta}>
						{tracked.movie.releaseYear && (
							<Text style={[styles.year, { color: colors.onSurfaceVariant }]}>{tracked.movie.releaseYear}</Text>
						)}
						{formattedWatchedDate && (
							<>
								<Text style={[styles.metaDot, { color: colors.onSurfaceVariant }]}>•</Text>
								<View style={styles.watchedRow}>
									<CheckCircle2 size={12} color={colors.primary} />
									<Text style={[styles.watchedDate, { color: colors.primary }]}>{formattedWatchedDate}</Text>
								</View>
							</>
						)}
					</View>
				</View>

				<TouchableOpacity
					onPress={(e) => {
						e.stopPropagation();
						onRemove(tracked.movieId);
					}}
					disabled={isRemoving}
					style={[styles.removeButton, { backgroundColor: colors.error }]}
					activeOpacity={0.7}
				>
					{isRemoving ? (
						<View style={styles.removeButtonContent}>
							<SpinningLoader size={14} color={colors.onError} />
							<Text style={[styles.removeButtonText, { color: colors.onError }]}>Loading</Text>
						</View>
					) : (
						<>
							<Trash2 size={14} color={colors.onError} />
							<Text style={[styles.removeButtonText, { color: colors.onError }]}>Remove</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	card: {
		flexDirection: "row",
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		borderWidth: 1,
	},
	posterContainer: {
		width: 80,
		aspectRatio: 2 / 3,
	},
	poster: {
		width: "100%",
		height: "100%",
	},
	cardContent: {
		flex: 1,
		padding: spacing.md,
		justifyContent: "space-between",
	},
	info: {
		flex: 1,
	},
	movieTitle: {
		fontSize: 16,
		fontWeight: "600",
		marginBottom: spacing.xs,
		lineHeight: 22,
	},
	meta: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: spacing.xs,
	},
	year: {
		fontSize: 14,
	},
	watchedRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	watchedDate: {
		fontSize: 14,
		fontWeight: "500",
	},
	removeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		alignSelf: "flex-start",
		marginTop: spacing.sm,
	},
	removeButtonText: {
		fontSize: 14,
		fontWeight: "600",
	},
	removeButtonContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	metaDot: {
		fontSize: 12,
	},
	noPoster: {
		justifyContent: "center",
		alignItems: "center",
	},
	noPosterText: {
		fontSize: 12,
		fontWeight: "500",
	},
});
