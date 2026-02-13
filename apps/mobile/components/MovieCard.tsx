import type { TrackedMovieDto } from "@opnshelf/api";
import { CheckCircle2, Trash2 } from "lucide-react-native";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, colors, spacing } from "@/constants/theme";
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
		<TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.8}>
			<View style={styles.posterContainer}>
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
			</View>

			<View style={styles.cardContent}>
				<View style={styles.info}>
					<Text style={styles.movieTitle} numberOfLines={2}>
						{tracked.movie.title}
					</Text>
					<View style={styles.meta}>
						{tracked.movie.releaseYear && (
							<Text style={styles.year}>{tracked.movie.releaseYear}</Text>
						)}
						{formattedWatchedDate && (
							<>
								<Text style={styles.metaDot}>•</Text>
								<View style={styles.watchedRow}>
									<CheckCircle2 size={12} color={colors.success} />
									<Text style={styles.watchedDate}>{formattedWatchedDate}</Text>
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
					style={styles.removeButton}
					activeOpacity={0.7}
				>
					{isRemoving ? (
						<SpinningLoader size={14} color={colors.text} />
					) : (
						<>
							<Trash2 size={14} color={colors.text} />
							<Text style={styles.removeButtonText}>Remove</Text>
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
		backgroundColor: colors.card,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: colors.border,
	},
	posterContainer: {
		width: 80,
		aspectRatio: 2 / 3,
		backgroundColor: colors.cardMuted,
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
		color: colors.text,
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
		color: colors.textMuted,
	},
	watchedRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	watchedDate: {
		fontSize: 14,
		color: colors.success,
		fontWeight: "500",
	},
	removeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.error,
		borderRadius: borderRadius.full,
		alignSelf: "flex-start",
		marginTop: spacing.sm,
	},
	removeButtonText: {
		color: colors.text,
		fontSize: 14,
		fontWeight: "600",
	},
	metaDot: {
		color: colors.textSecondary,
		fontSize: 12,
	},
	noPoster: {
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.cardMuted,
	},
	noPosterText: {
		color: colors.textSecondary,
		fontSize: 12,
		fontWeight: "500",
	},
});
