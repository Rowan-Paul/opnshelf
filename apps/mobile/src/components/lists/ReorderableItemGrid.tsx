import type { MediaInListDto } from "@opnshelf/api";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react-native";
import { useMemo, useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
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
import {
	dropIndex,
	type GridMetrics,
	slotFor,
	slotOffset,
} from "@/lib/reorder-grid";
import { posterUrl } from "@/lib/tmdb";

/** Posters are 2:3. */
const POSTER_RATIO = 3 / 2;
/** Horizontal padding inside a cell, matching the read-only grid's `px-1`. */
const CELL_GUTTER = 8;
/** Title line, label line, and the row gutter under them. */
const CAPTION_HEIGHT = 52;

function ReorderCell({
	item,
	index,
	count,
	metrics,
	activeIndex,
	dragX,
	dragY,
	onMove,
	onStep,
}: {
	item: MediaInListDto;
	index: number;
	count: number;
	metrics: GridMetrics;
	activeIndex: SharedValue<number>;
	dragX: SharedValue<number>;
	dragY: SharedValue<number>;
	onMove: (from: number, to: number) => void;
	onStep: (from: number, to: number) => void;
}) {
	const card = listItemToMediaCardItem(item);
	const sub = card.episode
		? `S${card.episode.seasonNumber}E${card.episode.episodeNumber} · ${card.episode.showTitle}`
		: (card.label ?? card.year);
	const posterHeight = (metrics.cellWidth - CELL_GUTTER) * POSTER_RATIO;

	// Long-press first: a plain pan would fight the vertical scroll.
	const pan = Gesture.Pan()
		.activateAfterLongPress(180)
		.onStart(() => {
			activeIndex.value = index;
			dragX.value = 0;
			dragY.value = 0;
		})
		.onUpdate((e) => {
			dragX.value = e.translationX;
			dragY.value = e.translationY;
		})
		.onEnd(() => {
			const to = dropIndex(index, dragX.value, dragY.value, count, metrics);
			if (to !== index) runOnJS(onMove)(index, to);
			activeIndex.value = -1;
			dragX.value = 0;
			dragY.value = 0;
		})
		.onFinalize(() => {
			activeIndex.value = -1;
			dragX.value = 0;
			dragY.value = 0;
		});

	const style = useAnimatedStyle(() => {
		const from = activeIndex.value;
		if (from === index) {
			return {
				transform: [
					{ translateX: dragX.value },
					{ translateY: dragY.value },
					{ scale: 1.05 },
				],
				zIndex: 10,
				elevation: 6,
				opacity: 0.95,
			};
		}
		const to =
			from === -1
				? -1
				: dropIndex(from, dragX.value, dragY.value, count, metrics);
		const offset = slotOffset(index, slotFor(index, from, to), metrics);
		return {
			transform: [
				{ translateX: withSpring(offset.x) },
				{ translateY: withSpring(offset.y) },
			],
			zIndex: 0,
			elevation: 0,
			opacity: 1,
		};
	});

	return (
		<GestureDetector gesture={pan}>
			<Animated.View
				style={[
					{ width: metrics.cellWidth, height: metrics.cellHeight },
					style,
				]}
				className="px-1 pb-3"
			>
				<View
					style={{ height: posterHeight }}
					className="overflow-hidden rounded-md bg-background-subtle"
				>
					<PosterImage
						url={posterUrl(card.posterPath, "w342")}
						className="h-full w-full"
					/>

					{/* Position is the whole point of this mode, so it stays visible. */}
					<View className="absolute top-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5">
						<Text className="font-medium text-[11px] text-white tabular-nums">
							{index + 1}/{count}
						</Text>
					</View>

					<View className="absolute top-1.5 right-1.5">
						<GripVertical color="#ffffff" size={16} />
					</View>

					{/* Kept alongside the drag: these are the only path for anyone who
					    cannot long-press and drag, and they read positions out loud. */}
					<View className="absolute inset-x-1.5 bottom-1.5 flex-row justify-between">
						<Pressable
							hitSlop={6}
							accessibilityLabel={`Move ${card.title} earlier`}
							disabled={index === 0}
							onPress={() => onStep(index, index - 1)}
							className={cn(
								"size-7 items-center justify-center rounded-full bg-black/70",
								index === 0 && "opacity-30",
							)}
						>
							<ChevronLeft color="#ffffff" size={18} />
						</Pressable>
						<Pressable
							hitSlop={6}
							accessibilityLabel={`Move ${card.title} later`}
							disabled={index === count - 1}
							onPress={() => onStep(index, index + 1)}
							className={cn(
								"size-7 items-center justify-center rounded-full bg-black/70",
								index === count - 1 && "opacity-30",
							)}
						>
							<ChevronRight color="#ffffff" size={18} />
						</Pressable>
					</View>
				</View>

				<Text
					className="mt-1.5 font-medium text-foreground text-xs"
					numberOfLines={1}
				>
					{card.title}
				</Text>
				{sub ? (
					<Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
						{sub}
					</Text>
				) : null}
			</Animated.View>
		</GestureDetector>
	);
}

/**
 * Drag-to-reorder for a list's items, as a poster grid. Web reorders by
 * dragging posters around the same grid the list already renders; a phone gets
 * that same picture, with a long-press to start the drag because that is the
 * native gesture for it.
 *
 * The array is not touched while a finger is down — the drag only decides a
 * target index, the other posters slide to show where the gap will be, and the
 * move commits on release. That keeps the dragged poster glued to the finger
 * instead of jumping each time the order changes underneath it.
 *
 * Rendered as a plain wrapping row rather than a FlashList: reorder mode
 * already fetches every page before it opens, and virtualisation fights cells
 * that move.
 */
export function ReorderableItemGrid({
	items,
	columns,
	onReorder,
}: {
	items: MediaInListDto[];
	columns: number;
	onReorder: (from: number, to: number) => void;
}) {
	const activeIndex = useSharedValue(-1);
	const dragX = useSharedValue(0);
	const dragY = useSharedValue(0);
	const [width, setWidth] = useState(0);

	// Cells are a fixed size so the drag can turn a finger offset into an index
	// without measuring each one.
	const metrics = useMemo<GridMetrics>(() => {
		const cellWidth = width > 0 ? width / columns : 0;
		return {
			columns,
			cellWidth,
			cellHeight: (cellWidth - CELL_GUTTER) * POSTER_RATIO + CAPTION_HEIGHT,
		};
	}, [width, columns]);

	const onLayout = (e: LayoutChangeEvent) =>
		setWidth(e.nativeEvent.layout.width);

	return (
		<View className="flex-row flex-wrap" onLayout={onLayout}>
			{metrics.cellWidth > 0
				? items.map((item, index) => (
						<ReorderCell
							key={item.id}
							item={item}
							index={index}
							count={items.length}
							metrics={metrics}
							activeIndex={activeIndex}
							dragX={dragX}
							dragY={dragY}
							onMove={onReorder}
							onStep={onReorder}
						/>
					))
				: null}
		</View>
	);
}
