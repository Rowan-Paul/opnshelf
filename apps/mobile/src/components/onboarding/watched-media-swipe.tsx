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
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import {
	isSwipeAccepted,
	type OnboardingMediaItem,
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
	const { width } = useWindowDimensions();
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

	return (
		<View className="flex-1 gap-4 pt-1">
			<View className="gap-1">
				<Text className="font-bold font-display text-3xl text-foreground">
					What have you watched?
				</Text>
				<Text className="text-muted-foreground text-sm">
					Swipe right to add a title to your Shelf, or left to skip it.
				</Text>
			</View>

			<View className="relative min-h-0 flex-1 justify-center">
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
					</View>
				) : null}
				{next ? (
					<MediaSwipeCard item={next} className="absolute inset-x-3" />
				) : null}
				{current ? (
					<GestureDetector gesture={gesture}>
						<Animated.View style={animatedStyle}>
							<MediaSwipeCard item={current} />
						</Animated.View>
					</GestureDetector>
				) : !discovery.isLoading && !discovery.isError ? (
					<Text className="text-center text-muted-foreground">
						You reached the end of the deck.
					</Text>
				) : null}
			</View>

			<View className="flex-row justify-center gap-5">
				<ActionButton
					label="Skip"
					disabled={!current || moving}
					onPress={() => void swipe("left")}
					icon={<X color="#94a3b8" size={25} />}
				/>
				<ActionButton
					label="Watched"
					disabled={!current || moving}
					onPress={() => void swipe("right")}
					icon={<Check color="#3f2e00" size={25} />}
					primary
				/>
			</View>
			<Pressable
				accessibilityRole="button"
				onPress={onNext}
				className="items-center py-3"
			>
				<Text className="font-semibold text-muted-foreground">Continue</Text>
			</Pressable>
		</View>
	);
}

function MediaSwipeCard({
	item,
	className,
}: {
	item: OnboardingMediaItem;
	className?: string;
}) {
	return (
		<View
			className={`overflow-hidden rounded-3xl border border-border bg-card ${className ?? ""}`}
			style={{
				borderCurve: "continuous",
				boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
			}}
		>
			<PosterImage
				url={posterUrl(item.posterPath, "w500")}
				className="aspect-2/3 w-full"
			/>
			<View className="gap-2 p-4">
				<View className="flex-row items-start justify-between gap-3">
					<Text
						className="min-w-0 flex-1 font-bold font-display text-foreground text-xl"
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
				<Text className="text-muted-foreground text-sm">
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
	disabled,
	onPress,
}: {
	label: string;
	icon: React.ReactNode;
	primary?: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			disabled={disabled}
			onPress={onPress}
			className={`size-16 items-center justify-center rounded-full border ${primary ? "border-primary bg-primary" : "border-border bg-card"}`}
			style={{ opacity: disabled ? 0.5 : 1 }}
		>
			{icon}
		</Pressable>
	);
}
