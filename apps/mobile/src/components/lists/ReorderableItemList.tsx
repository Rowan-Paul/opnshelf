import type { MediaInListDto } from "@opnshelf/api";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	runOnJS,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { listItemToMediaCardItem } from "@/lib/list-media";
import { posterUrl } from "@/lib/tmdb";

/**
 * Rows are a fixed height so the drag can turn a finger offset into an index
 * without measuring anything: `round(translationY / ROW_HEIGHT)`.
 */
const ROW_HEIGHT = 80;

/** Where a row sits while some other row is being dragged over it. */
function shiftFor(index: number, from: number, to: number): number {
	"worklet";
	if (from === -1 || from === to) return 0;
	if (index === from) return 0;
	// Dragging down: everything between the old and new slot moves up one.
	if (from < to && index > from && index <= to) return -ROW_HEIGHT;
	if (from > to && index >= to && index < from) return ROW_HEIGHT;
	return 0;
}

function ReorderRow({
	item,
	index,
	count,
	activeIndex,
	dragY,
	onMove,
	onStep,
}: {
	item: MediaInListDto;
	index: number;
	count: number;
	activeIndex: SharedValue<number>;
	dragY: SharedValue<number>;
	onMove: (from: number, to: number) => void;
	onStep: (from: number, to: number) => void;
}) {
	const card = listItemToMediaCardItem(item);
	const sub = card.episode
		? `S${card.episode.seasonNumber}E${card.episode.episodeNumber} · ${card.episode.showTitle}`
		: (card.label ?? card.year);

	// Long-press first: a plain pan would fight the vertical scroll.
	const pan = Gesture.Pan()
		.activateAfterLongPress(180)
		.onStart(() => {
			activeIndex.value = index;
			dragY.value = 0;
		})
		.onUpdate((e) => {
			dragY.value = e.translationY;
		})
		.onEnd(() => {
			const steps = Math.round(dragY.value / ROW_HEIGHT);
			const to = Math.min(Math.max(index + steps, 0), count - 1);
			if (to !== index) runOnJS(onMove)(index, to);
			activeIndex.value = -1;
			dragY.value = 0;
		})
		.onFinalize(() => {
			activeIndex.value = -1;
			dragY.value = 0;
		});

	const style = useAnimatedStyle(() => {
		const from = activeIndex.value;
		if (from === index) {
			return {
				transform: [{ translateY: dragY.value }, { scale: 1.03 }],
				zIndex: 10,
				elevation: 6,
				opacity: 0.95,
			};
		}
		const steps = Math.round(dragY.value / ROW_HEIGHT);
		const to = Math.min(Math.max(from + steps, 0), count - 1);
		return {
			transform: [{ translateY: withSpring(shiftFor(index, from, to)) }],
			zIndex: 0,
			elevation: 0,
			opacity: 1,
		};
	});

	return (
		<GestureDetector gesture={pan}>
			<Animated.View
				style={[{ height: ROW_HEIGHT }, style]}
				className="flex-row items-center gap-3 rounded-xl bg-background px-1"
			>
				<GripVertical color="#94a3b8" size={18} />

				<View className="h-16 w-11 overflow-hidden rounded-md bg-background-subtle">
					<PosterImage
						url={posterUrl(card.posterPath, "w185")}
						className="h-16 w-11"
					/>
				</View>

				<View className="min-w-0 flex-1">
					<Text
						className="font-medium text-foreground text-sm"
						numberOfLines={2}
					>
						{card.title}
					</Text>
					{sub ? (
						<Text className="text-muted-foreground text-xs" numberOfLines={1}>
							{sub}
						</Text>
					) : null}
					<Text className="text-muted-foreground text-xs tabular-nums">
						{index + 1} / {count}
					</Text>
				</View>

				{/* Kept alongside the drag: these are the only path for anyone who
				    cannot long-press and drag, and they read positions out loud. */}
				<View className="flex-row items-center gap-1">
					<Pressable
						hitSlop={6}
						accessibilityLabel={`Move ${card.title} earlier`}
						disabled={index === 0}
						onPress={() => onStep(index, index - 1)}
						className={cn(
							"size-9 items-center justify-center rounded-full bg-background-subtle",
							index === 0 && "opacity-30",
						)}
					>
						<ChevronUp color="#94a3b8" size={20} />
					</Pressable>
					<Pressable
						hitSlop={6}
						accessibilityLabel={`Move ${card.title} later`}
						disabled={index === count - 1}
						onPress={() => onStep(index, index + 1)}
						className={cn(
							"size-9 items-center justify-center rounded-full bg-background-subtle",
							index === count - 1 && "opacity-30",
						)}
					>
						<ChevronDown color="#94a3b8" size={20} />
					</Pressable>
				</View>
			</Animated.View>
		</GestureDetector>
	);
}

/**
 * Drag-to-reorder for a list's items. Web reorders by dragging posters in the
 * grid; a phone gets the same capability through a long-press drag, which is
 * the native gesture for it.
 *
 * The array is not touched while a finger is down — the drag only decides a
 * target index, other rows shift to show where the gap will be, and the move
 * commits on release. That keeps the dragged row glued to the finger instead of
 * jumping each time the order changes underneath it.
 *
 * Rendered as a plain column rather than a FlashList: reorder mode already
 * fetches every page before it opens, and virtualisation fights rows that move.
 */
export function ReorderableItemList({
	items,
	onReorder,
}: {
	items: MediaInListDto[];
	onReorder: (from: number, to: number) => void;
}) {
	const activeIndex = useSharedValue(-1);
	const dragY = useSharedValue(0);

	return (
		<View>
			{items.map((item, index) => (
				<ReorderRow
					key={item.id}
					item={item}
					index={index}
					count={items.length}
					activeIndex={activeIndex}
					dragY={dragY}
					onMove={onReorder}
					onStep={onReorder}
				/>
			))}
		</View>
	);
}
