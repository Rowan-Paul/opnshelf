import { useCallback } from "react";
import type { TmdbMovieResultDto } from "@opnshelf/api";
import { Check, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import {
	type GestureResponderEvent,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { getTmdbPosterUrl } from "@/lib/utils";
import { SpinningLoader } from "./SpinningLoader";

interface MovieItemProps {
	movie: TmdbMovieResultDto;
	isWatched: boolean;
	isMarking: boolean;
	isUnmarking: boolean;
	onToggle: (movieId: string, isWatched: boolean) => void;
	onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MovieItem({
	movie,
	isWatched,
	isMarking,
	isUnmarking,
	onToggle,
	onPress,
}: MovieItemProps) {
	const scale = useSharedValue(1);
	const opacity = useSharedValue(1);

	const handleToggle = useCallback(
		(e: GestureResponderEvent) => {
			e.stopPropagation();

			if (Platform.OS !== "web") {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
			}

			onToggle(movie.id.toString(), isWatched);
		},
		[movie.id, isWatched, onToggle],
	);

	const handlePressIn = useCallback(() => {
		scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
		opacity.value = withTiming(0.8, { duration: 100 });
	}, [scale, opacity]);

	const handlePressOut = useCallback(() => {
		scale.value = withSpring(1, { damping: 15, stiffness: 300 });
		opacity.value = withTiming(1, { duration: 100 });
	}, [scale, opacity]);

	const animatedButtonStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
		opacity: opacity.value,
	}));

	const isPending = isMarking || isUnmarking;
	const posterUrl = getTmdbPosterUrl(movie.poster_path);

	return (
		<View style={styles.movieItem}>
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

				<AnimatedPressable
					onPress={handleToggle}
					onPressIn={handlePressIn}
					onPressOut={handlePressOut}
					disabled={isPending}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
					style={[
						styles.actionButton,
						isWatched && styles.actionButtonWatched,
						animatedButtonStyle,
					]}
				>
					<View style={styles.iconContainer}>
						{isPending ? (
							<SpinningLoader size={16} color={colors.text} />
						) : isWatched ? (
							<Check size={16} color={colors.text} strokeWidth={2.5} />
						) : (
							<Plus size={16} color={colors.text} strokeWidth={2.5} />
						)}
					</View>
				</AnimatedPressable>
			</Pressable>
			<Pressable onPress={onPress} style={styles.titleContainer}>
				<Text style={styles.movieTitle} numberOfLines={2}>
					{movie.title}
				</Text>
				{movie.release_date && (
					<View style={styles.yearBadge}>
						<Text style={styles.movieYear}>
							{movie.release_date.split("-")[0]}
						</Text>
					</View>
				)}
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	movieItem: {
		flexDirection: "row",
		padding: spacing.sm,
		backgroundColor: colors.card,
		borderRadius: borderRadius.md,
		marginBottom: spacing.sm,
	},
	posterContainer: {
		position: "relative",
	},
	poster: {
		width: 80,
		height: 120,
		borderRadius: borderRadius.sm,
	},
	noPoster: {
		backgroundColor: colors.cardMuted,
		justifyContent: "center",
		alignItems: "center",
	},
	noPosterText: {
		color: colors.textMuted,
		fontSize: 10,
		textAlign: "center",
	},
	actionButton: {
		position: "absolute",
		top: -4,
		right: -4,
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: colors.primary,
		justifyContent: "center",
		alignItems: "center",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 2,
	},
	actionButtonWatched: {
		backgroundColor: colors.success,
	},
	iconContainer: {
		justifyContent: "center",
		alignItems: "center",
	},
	titleContainer: {
		flex: 1,
		marginLeft: spacing.md,
		justifyContent: "center",
	},
	movieTitle: {
		color: colors.text,
		fontSize: 14,
		fontWeight: "600",
		marginBottom: spacing.xs,
	},
	yearBadge: {
		alignSelf: "flex-start",
		backgroundColor: colors.cardMuted,
		paddingHorizontal: spacing.sm,
		paddingVertical: 2,
		borderRadius: borderRadius.sm,
	},
	movieYear: {
		color: colors.textMuted,
		fontSize: 12,
	},
});
