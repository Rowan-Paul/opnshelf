import {
	type MovieCollectionDto,
	movieCollectionRail,
	moviesControllerGetUserMovieWatchCountsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
	type LayoutChangeEvent,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	View,
} from "react-native";
import { MediaCard } from "@/components/media/MediaCard";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/theme/colors";

const CARD_WIDTH = 112;
const CARD_GAP = 12;
const EDGE_PADDING = 16;

/**
 * The hero's link to the rail: names the collection and where this movie sits
 * in it. Pressing it brings the rail, which is below the fold, into view.
 * Mirrors the Web App's `MovieCollectionEyebrow`.
 */
export function MovieCollectionEyebrow({
	collection,
	movieId,
	onPress,
}: {
	collection: MovieCollectionDto | undefined;
	movieId: string;
	onPress: () => void;
}) {
	const colors = useThemeColors();
	const rail = movieCollectionRail(collection, movieId);
	if (!rail) return null;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityHint="Scrolls to the movies in this collection"
			onPress={onPress}
			hitSlop={8}
			// An opaque pill, as the hero's other metadata uses: the backdrop is
			// too uneven to carry small text on its own.
			className="mb-1.5 flex-row items-center gap-1.5 self-start rounded-full bg-background-subtle px-3 py-1"
		>
			<Layers color={colors.mutedForeground} size={12} />
			<Text
				className="shrink font-semibold text-muted-foreground text-xs"
				numberOfLines={2}
			>
				{rail.name} · Movie {rail.position} of {rail.total}
			</Text>
		</Pressable>
	);
}

/**
 * Row of every movie in the collection this movie belongs to, for switching
 * between them the way a show screen lists its seasons. Uses the same cards as
 * Similar Movies, so each one carries its shelf toggle and quick actions.
 * Renders nothing for a movie that stands alone. Mirrors the Web App's
 * `MovieCollectionRail`.
 */
export function MovieCollectionRail({
	collection,
	movieId,
	onLayout,
}: {
	collection: MovieCollectionDto | undefined;
	movieId: string;
	/** Reports where the rail sits on the screen, for the hero's eyebrow. */
	onLayout?: (event: LayoutChangeEvent) => void;
}) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";
	const { data: watchCounts } = useQuery({
		...moviesControllerGetUserMovieWatchCountsOptions({ path: { userDid } }),
		enabled: isAuthenticated && !!userDid,
	});
	const rail = movieCollectionRail(collection, movieId, watchCounts);
	const rowRef = useRef<ScrollViewInstance>(null);
	const [rowWidth, setRowWidth] = useState(0);
	const position = rail?.position ?? 0;

	// Keep this movie in the middle, so its neighbours on both sides show
	// however far into a long collection it sits.
	useEffect(() => {
		if (!rowWidth || !position) return;
		const cardStart = EDGE_PADDING + (position - 1) * (CARD_WIDTH + CARD_GAP);
		rowRef.current?.scrollTo({
			x: Math.max(0, cardStart - (rowWidth - CARD_WIDTH) / 2),
			animated: false,
		});
	}, [rowWidth, position]);

	if (!rail) return null;
	const showWatches = isAuthenticated && !!watchCounts;

	return (
		<View onLayout={onLayout}>
			<View className="mb-2 flex-row items-baseline justify-between gap-4 px-4">
				<Text className="flex-1 text-display-3 text-foreground">
					{rail.name} movies
				</Text>
				{isAuthenticated ? (
					// Holds its place while the Watches load so the heading row
					// does not reflow when they arrive.
					<Text
						className="text-muted-foreground text-xs"
						style={{
							fontVariant: ["tabular-nums"],
							opacity: showWatches ? 1 : 0,
						}}
					>
						{rail.watchedCount} of {rail.total} watched
					</Text>
				) : null}
			</View>
			<ScrollView
				ref={rowRef}
				horizontal
				showsHorizontalScrollIndicator={false}
				onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
				contentContainerStyle={{
					gap: CARD_GAP,
					paddingHorizontal: EDGE_PADDING,
				}}
			>
				{rail.items.map((item) => {
					const card = {
						id: Number(item.id),
						type: "movie" as const,
						title: item.title,
						posterPath: item.posterPath,
						year: item.year ? String(item.year) : "TBA",
					};
					return (
						<View
							key={item.id}
							style={{ width: CARD_WIDTH }}
							accessibilityLabel={`Movie ${item.position}${item.isCurrent ? ", current movie" : ""}`}
						>
							{item.isCurrent ? (
								// Already on this movie's screen, which has its own
								// shelf button: show the state, open nothing.
								<View pointerEvents="none">
									<MediaCard item={card} isWatched={item.isWatched} />
								</View>
							) : (
								<MediaCard item={card} actions />
							)}
							{/* Lies over the card's poster: the place in the collection,
							    and the accent ring on the movie this screen is about. */}
							<View
								pointerEvents="none"
								className={`absolute inset-x-0 top-0 aspect-2/3 rounded-lg ${item.isCurrent ? "border-2 border-accent" : ""}`}
							>
								<View className="absolute bottom-1.5 left-1.5 h-[22px] min-w-[22px] items-center justify-center rounded-md bg-black/70 px-1.5">
									<Text
										className="font-semibold text-white text-xs"
										style={{ fontVariant: ["tabular-nums"] }}
									>
										{item.position}
									</Text>
								</View>
							</View>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
}
