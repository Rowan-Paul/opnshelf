import {
	invalidateWatchActivityQueries,
	moviesControllerMarkWatchedMutation,
	onboardingDiscoveryOptions,
	showsControllerMarkShowWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Check, Star, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Extrapolation,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import {
	isSwipeAccepted,
	type OnboardingMediaItem,
	onboardingCardWidth,
	toOnboardingMediaItem,
} from "@/lib/onboarding-media";
import { posterUrl } from "@/lib/tmdb";

export function WatchedMediaSwipe({
	onNext,
	onWatched,
}: {
	onNext: () => void;
	onWatched: () => void;
}) {
	const { height, width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const compact = height < 720;
	const cardWidth = onboardingCardWidth(width, height);
	const queryClient = useQueryClient();
	const toast = useToast();
	const [index, setIndex] = useState(0);
	const [moving, setMoving] = useState(false);
	const x = useSharedValue(0);
	const y = useSharedValue(0);

	const discovery = useQuery(onboardingDiscoveryOptions());
	const items = useMemo(
		() => (discovery.data?.results ?? []).map(toOnboardingMediaItem),
		[discovery.data],
	);
	const current = items[index];
	const next = items[index + 1];

	const movieMutation = useMutation({
		mutationKey: ["onboarding", "movies", "markWatched"],
		...moviesControllerMarkWatchedMutation(),
	});
	const showMutation = useMutation({
		mutationKey: ["onboarding", "shows", "markWatched"],
		...showsControllerMarkShowWatchedMutation(),
	});

	const reset = () => {
		x.value = withSpring(0);
		y.value = withSpring(0);
		setMoving(false);
	};

	const finish = (direction: "left" | "right") => {
		x.value = 0;
		y.value = 0;
		setIndex((value) => value + 1);
		setMoving(false);
		if (process.env.EXPO_OS === "ios") {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => {},
			);
		}
		if (direction === "right") onWatched();
	};

	const swipe = async (direction: "left" | "right") => {
		if (!current || moving) return;
		setMoving(true);
		if (direction === "right") {
			try {
				if (current.type === "movie") {
					await movieMutation.mutateAsync({
						body: { movieId: String(current.id), watchedAt: null },
					});
				} else {
					const result = await showMutation.mutateAsync({
						body: { showId: String(current.id), watchedAt: null },
					});
					if (result.count === 0) {
						throw new Error("No episodes were added. Try again later.");
					}
					if (result.count < result.requested) {
						toast.error(
							`Added ${result.count} of ${result.requested} episodes. Try the rest later.`,
						);
					}
				}
				invalidateWatchActivityQueries(queryClient);
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Failed to add this title",
				);
				reset();
				return;
			}
		}
		x.value = withTiming(direction === "right" ? width : -width, {
			duration: 220,
		});
		setTimeout(() => finish(direction), 220);
	};

	const gesture = Gesture.Pan()
		.runOnJS(true)
		.enabled(!moving && !!current)
		.onUpdate((event) => {
			x.value = event.translationX;
			y.value = event.translationY * 0.2;
		})
		.onEnd((event) => {
			if (isSwipeAccepted(event.translationX, width)) {
				void swipe(event.translationX > 0 ? "right" : "left");
			} else reset();
		});

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: x.value },
			{ translateY: y.value },
			{
				rotate: `${interpolate(x.value, [-width, 0, width], [-10, 0, 10])}deg`,
			},
		],
	}));
	const skipFeedbackStyle = useAnimatedStyle(() => ({
		opacity: interpolate(
			x.value,
			[-width * 0.25, -24, 0],
			[1, 0.35, 0],
			Extrapolation.CLAMP,
		),
		transform: [
			{
				scale: interpolate(
					x.value,
					[-width * 0.25, -24, 0],
					[1, 0.9, 0.85],
					Extrapolation.CLAMP,
				),
			},
			{ rotate: "8deg" },
		],
	}));
	const watchedFeedbackStyle = useAnimatedStyle(() => ({
		opacity: interpolate(
			x.value,
			[0, 24, width * 0.25],
			[0, 0.35, 1],
			Extrapolation.CLAMP,
		),
		transform: [
			{
				scale: interpolate(
					x.value,
					[0, 24, width * 0.25],
					[0.85, 0.9, 1],
					Extrapolation.CLAMP,
				),
			},
			{ rotate: "-8deg" },
		],
	}));

	return (
		<View
			className={`flex-1 pt-1 ${compact ? "gap-2" : "gap-4"}`}
			// This step pins its own footer instead of using StepScaffold, so it
			// needs the same bottom safe-area padding the scaffold applies.
			style={{ paddingBottom: insets.bottom + 8 }}
		>
			<View className={compact ? "gap-0.5" : "gap-1"}>
				<Text
					className={`font-bold font-display text-foreground ${compact ? "text-2xl leading-7" : "text-3xl"}`}
				>
					What have you watched?
				</Text>
				<Text
					className={`text-muted-foreground ${compact ? "text-xs leading-4" : "text-sm"}`}
				>
					Swipe right to add a title to your Shelf, or left to skip it.
				</Text>
			</View>

			<View className="relative min-h-0 flex-1 items-center justify-center">
				{discovery.isLoading ? <ActivityIndicator color="#f3bc00" /> : null}
				{discovery.isError ? (
					<View className="items-center gap-3">
						<Text className="text-center text-muted-foreground">
							Could not load titles.
						</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => discovery.refetch()}
							className="rounded-lg border border-border px-4 py-3"
						>
							<Text className="font-semibold text-foreground">Try again</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={onNext}
							className="py-2"
						>
							<Text className="font-semibold text-muted-foreground">
								Skip this step
							</Text>
						</Pressable>
					</View>
				) : null}
				{next ? (
					<View className="absolute inset-0 items-center justify-center">
						<MediaSwipeCard
							item={next}
							compact={compact}
							style={{
								opacity: 0.6,
								transform: [{ translateY: 8 }, { scale: 0.96 }],
								width: cardWidth,
							}}
						/>
					</View>
				) : null}
				{current ? (
					<GestureDetector gesture={gesture}>
						<Animated.View style={[{ width: cardWidth }, animatedStyle]}>
							<MediaSwipeCard item={current} compact={compact} />
							<Animated.View
								pointerEvents="none"
								className="absolute top-5 right-4 flex-row items-center gap-1 rounded-lg border-4 border-red-400 px-3 py-1.5"
								style={skipFeedbackStyle}
							>
								<X color="#f87171" size={20} strokeWidth={3} />
								<Text className="font-bold text-lg text-red-400">SKIP</Text>
							</Animated.View>
							<Animated.View
								pointerEvents="none"
								className="absolute top-5 left-4 flex-row items-center gap-1 rounded-lg border-4 border-green-400 px-3 py-1.5"
								style={watchedFeedbackStyle}
							>
								<Check color="#4ade80" size={20} strokeWidth={3} />
								<Text className="font-bold text-green-400 text-lg">
									WATCHED
								</Text>
							</Animated.View>
						</Animated.View>
					</GestureDetector>
				) : !discovery.isLoading && !discovery.isError ? (
					<View className="items-center gap-3 px-6">
						<View className="size-16 items-center justify-center rounded-full bg-green-500/10">
							<Check color="#22c55e" size={32} />
						</View>
						<Text className="text-center font-bold font-display text-2xl text-foreground">
							That is the stack
						</Text>
						<Text className="text-center text-muted-foreground text-sm">
							Your picks are now on your Shelf.
						</Text>
					</View>
				) : null}
			</View>

			{current ? (
				<View className="flex-row justify-center gap-5">
					<ActionButton
						label="Skip"
						compact={compact}
						disabled={moving}
						onPress={() => void swipe("left")}
						icon={<X color="#94a3b8" size={25} />}
					/>
					<ActionButton
						label="Watched"
						compact={compact}
						disabled={moving}
						onPress={() => void swipe("right")}
						icon={<Check color="#3f2e00" size={25} />}
						primary
					/>
				</View>
			) : null}
			{current || (!discovery.isLoading && !discovery.isError) ? (
				<Pressable
					accessibilityRole="button"
					disabled={moving}
					onPress={onNext}
					className={`items-center rounded-lg py-3 ${current ? "" : "bg-primary"}`}
					style={{ opacity: moving ? 0.5 : 1 }}
				>
					<Text
						className={`font-semibold ${current ? "text-muted-foreground" : "text-primary-foreground"}`}
					>
						{current ? "Skip this step" : "Continue"}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function MediaSwipeCard({
	item,
	className,
	compact,
	style,
}: {
	item: OnboardingMediaItem;
	className?: string;
	compact?: boolean;
	style?: ViewStyle;
}) {
	return (
		<View
			className={`overflow-hidden rounded-3xl border border-border bg-card ${className ?? ""}`}
			style={{
				borderCurve: "continuous",
				boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
				...style,
			}}
		>
			<PosterImage
				url={posterUrl(item.posterPath, "w500")}
				className="aspect-2/3 w-full"
			/>
			<View className={compact ? "gap-1 p-3" : "gap-2 p-4"}>
				<View className="flex-row items-start justify-between gap-3">
					<Text
						className={`min-w-0 flex-1 font-bold font-display text-foreground ${compact ? "text-lg" : "text-xl"}`}
						numberOfLines={2}
					>
						{item.title}
					</Text>
					{item.rating ? (
						<View className="flex-row items-center gap-1">
							<Star color="#f3bc00" fill="#f3bc00" size={14} />
							<Text className="text-muted-foreground text-sm">
								{item.rating.toFixed(1)}
							</Text>
						</View>
					) : null}
				</View>
				<Text
					className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
				>
					{item.type === "movie" ? "Movie" : "Show"}
					{item.year ? ` · ${item.year}` : ""}
				</Text>
			</View>
		</View>
	);
}

function ActionButton({
	label,
	icon,
	primary,
	compact,
	disabled,
	onPress,
}: {
	label: string;
	icon: React.ReactNode;
	primary?: boolean;
	compact?: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			disabled={disabled}
			onPress={onPress}
			className={`${compact ? "size-14" : "size-16"} items-center justify-center rounded-full border ${primary ? "border-primary bg-primary" : "border-border bg-card"}`}
			style={{ opacity: disabled ? 0.5 : 1 }}
		>
			{icon}
		</Pressable>
	);
}
