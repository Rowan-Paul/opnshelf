import type { TmdbMovieDetailDto } from "@opnshelf/api";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { colors, spacing } from "@/constants/theme";
import {
	formatRuntime,
	getReleaseYear,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
} from "@/lib/utils";

interface MovieHeroProps {
	movie: TmdbMovieDetailDto | null;
	title: string;
	showHours: boolean;
	onToggleHours: () => void;
	onBack: () => void;
}

export function MovieHero({
	movie,
	title,
	showHours,
	onToggleHours,
	onBack,
}: MovieHeroProps) {
	const backdropUrl = getTmdbBackdropUrl(movie?.backdrop_path);
	const posterUrl = getTmdbPosterUrl(movie?.poster_path, "w500");
	const releaseYear = getReleaseYear(movie?.release_date);

	const movieColors = {
		primary: "#8b5cf6",
		accent: "#a855f7",
		muted: "#4c1d95",
	};

	return (
		<View style={styles.heroWrapper}>
			{backdropUrl ? (
				<Image
					source={{ uri: backdropUrl }}
					style={styles.backdrop}
					contentFit="cover"
				/>
			) : (
				<View
					style={[styles.backdrop, { backgroundColor: movieColors.muted }]}
				/>
			)}

			<TouchableOpacity
				onPress={onBack}
				style={styles.backButton}
				activeOpacity={0.8}
			>
				<Ionicons name="arrow-back" size={24} color="#f9fafb" />
			</TouchableOpacity>

			<View style={styles.heroOverlay}>
				<View style={styles.posterWrapper}>
					{posterUrl ? (
						<Image
							source={{ uri: posterUrl }}
							style={styles.poster}
							contentFit="cover"
						/>
					) : (
						<View style={[styles.poster, styles.noPoster]}>
							<Text style={styles.noPosterText}>No poster</Text>
						</View>
					)}
				</View>

				<View style={styles.titleWrapper}>
					<Text
						style={[styles.title, { textShadowColor: movieColors.primary }]}
						numberOfLines={2}
						adjustsFontSizeToFit
						minimumFontScale={0.7}
					>
						{movie?.title || title}
					</Text>
					<View style={styles.metaRow}>
						{!!releaseYear && (
							<View style={styles.metaItem}>
								<Ionicons
									name="calendar-outline"
									size={14}
									color={movieColors.accent}
								/>
								<Text style={styles.metaText}>{releaseYear}</Text>
							</View>
						)}
						{movie?.runtime && (
							<TouchableOpacity
								onPress={onToggleHours}
								style={styles.metaItem}
								activeOpacity={0.8}
							>
								<Ionicons
									name="time-outline"
									size={14}
									color={movieColors.accent}
								/>
								<Text style={styles.metaText}>
									{formatRuntime(movie.runtime, showHours)}
								</Text>
							</TouchableOpacity>
						)}
					</View>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	heroWrapper: {
		position: "relative",
		height: 300,
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
		width: "100%",
		height: 300,
	},
	heroOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.4)",
		flexDirection: "row",
		alignItems: "flex-end",
		padding: spacing.lg,
	},
	backButton: {
		position: "absolute",
		top: 50,
		left: spacing.md,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	posterWrapper: {
		width: 100,
		height: 150,
		borderRadius: 8,
		overflow: "hidden",
		backgroundColor: "#1f2937",
	},
	poster: {
		width: "100%",
		height: "100%",
	},
	noPoster: {
		justifyContent: "center",
		alignItems: "center",
	},
	noPosterText: {
		color: "#9ca3af",
		fontSize: 12,
	},
	titleWrapper: {
		flex: 1,
		marginLeft: spacing.md,
		marginBottom: spacing.xs,
	},
	title: {
		color: "#f9fafb",
		fontSize: 20,
		fontWeight: "bold",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 4,
		marginBottom: spacing.xs,
	},
	metaRow: {
		flexDirection: "row",
		gap: spacing.md,
	},
	metaItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	metaText: {
		color: "#d1d5db",
		fontSize: 12,
	},
});
