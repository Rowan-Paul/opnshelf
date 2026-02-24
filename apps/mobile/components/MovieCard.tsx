import { Trash2 } from "lucide-react-native";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { getTmdbPosterUrl } from "@/lib/utils";
import { MediaCard } from "./MediaCard";
import { SpinningLoader } from "./SpinningLoader";

export interface ShelfMovieItem {
	id: string;
	type: "movie";
	movieId: string;
	title: string;
	posterPath?: string;
	backdropPath?: string;
	releaseYear?: number;
	overview?: string;
	colors?: unknown;
	watchedDate?: string;
	createdAt: string;
}

interface MovieCardProps {
	tracked: ShelfMovieItem;
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

	const posterUrl = getTmdbPosterUrl(tracked.posterPath);

	return (
		<MediaCard
			onPress={onPress}
			cardStyle={{
				backgroundColor: colors.surfaceContainer,
				borderColor: colors.outline,
			}}
			mediaContainerStyle={{
				backgroundColor: colors.surfaceContainerHigh,
			}}
			media={
				posterUrl ? (
					<Image
						source={{ uri: posterUrl }}
						style={styles.poster}
						contentFit="cover"
						transition={200}
					/>
				) : (
					<View
						style={[
							styles.poster,
							styles.noPoster,
							{ backgroundColor: colors.surfaceContainerHigh },
						]}
					>
						<Text
							style={[styles.noPosterText, { color: colors.onSurfaceVariant }]}
						>
							No poster
						</Text>
					</View>
				)
			}
		>
			<View style={styles.info}>
				<Text
					style={[styles.movieTitle, { color: colors.onSurface }]}
					numberOfLines={2}
				>
					{tracked.title}
				</Text>
				<View style={styles.meta}>
					{tracked.releaseYear && (
						<Text style={[styles.year, { color: colors.onSurfaceVariant }]}>
							{tracked.releaseYear}
						</Text>
					)}
					{formattedWatchedDate && (
						<>
							{tracked.releaseYear ? (
								<Text style={[styles.metaDot, { color: colors.onSurfaceVariant }]}>
									•
								</Text>
							) : null}
							<Text style={[styles.watchedDate, { color: colors.onSurfaceVariant }]}>
								{formattedWatchedDate}
							</Text>
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
						<Text style={[styles.removeButtonText, { color: colors.onError }]}>
							Loading
						</Text>
					</View>
				) : (
					<>
						<Trash2 size={14} color={colors.onError} />
						<Text style={[styles.removeButtonText, { color: colors.onError }]}>
							Remove
						</Text>
					</>
				)}
			</TouchableOpacity>
		</MediaCard>
	);
}

const styles = StyleSheet.create({
	poster: {
		width: "100%",
		height: "100%",
	},
	info: {
		flex: 1,
	},
	movieTitle: {
		fontSize: 14,
		fontWeight: "600",
		marginBottom: spacing.xs,
		lineHeight: 19,
	},
	meta: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: spacing.xs,
	},
	year: {
		fontSize: 12,
	},
	watchedDate: {
		fontSize: 12,
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
		fontSize: 12,
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
