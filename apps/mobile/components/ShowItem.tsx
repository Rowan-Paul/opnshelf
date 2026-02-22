import { useCallback, useMemo } from "react";
import { Check, Loader2, Plus } from "lucide-react-native";
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
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSpring,
	withTiming,
} from "react-native-reanimated";
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
	onToggle?: (showId: string, isWatched: boolean) => void;
	isWatched?: boolean;
	isMarking?: boolean;
	isUnmarking?: boolean;
	metaText?: string;
	width?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SpinningLoader = ({ size, color }: { size: number; color: string }) => {
	const rotation = useSharedValue(0);

	rotation.value = withRepeat(
		withTiming(360, { duration: 1000, easing: Easing.linear }),
		-1,
		false,
	);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	return (
		<Animated.View style={animatedStyle}>
			<Loader2 size={size} color={color} />
		</Animated.View>
	);
};

export function ShowItem({
	show,
	onPress,
	onToggle,
	isWatched = false,
	isMarking = false,
	isUnmarking = false,
	metaText,
	width,
}: ShowItemProps) {
	const { colors } = useTheme();
	const scale = useSharedValue(1);
	const opacity = useSharedValue(1);

	const handleToggle = useCallback(
		(e: GestureResponderEvent) => {
			e.stopPropagation();
			if (!onToggle) return;

			if (Platform.OS !== "web") {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
			}

			onToggle(show.id.toString(), isWatched);
		},
		[show.id, isWatched, onToggle],
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
	const posterUrl = getTmdbPosterUrl(
		show.poster_path ?? show.posterPath ?? null,
	);
	const firstAirDate = show.first_air_date ?? show.firstAirDate ?? null;
	const year = firstAirDate ? firstAirDate.split("-")[0] : undefined;
	const hasToggle = !!onToggle;

	const styles = useMemo(
		() =>
			StyleSheet.create({
				showItem: {
					width: width,
					marginBottom: spacing.lg,
					marginHorizontal: spacing.xs,
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
					position: "relative",
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
				actionButton: {
					position: "absolute",
					top: spacing.sm,
					right: spacing.sm,
					width: 40,
					height: 40,
					borderRadius: borderRadius.full,
					backgroundColor: colors.primary,
					justifyContent: "center",
					alignItems: "center",
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 3 },
					shadowOpacity: 0.4,
					shadowRadius: 5,
					elevation: 5,
				},
				actionButtonWatched: {
					backgroundColor: "#16a34a",
				},
				iconContainer: {
					width: 20,
					height: 20,
					justifyContent: "center",
					alignItems: "center",
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
			width,
			colors.surfaceContainer,
			colors.surfaceContainerHigh,
			colors.onSurfaceVariant,
			colors.primary,
			colors.tertiary,
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

				{hasToggle && (
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
								<SpinningLoader size={16} color={colors.onSurface} />
							) : isWatched ? (
								<Check size={16} color={colors.onSurface} strokeWidth={2.5} />
							) : (
								<Plus size={16} color={colors.onSurface} strokeWidth={2.5} />
							)}
						</View>
					</AnimatedPressable>
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
