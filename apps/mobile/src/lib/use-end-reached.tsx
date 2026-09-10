import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";
import {
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	ScrollView,
	type ScrollViewProps,
} from "react-native";

type Listener = () => void;

const EndReachedContext = createContext<{
	subscribe: (listener: Listener) => () => void;
} | null>(null);

/**
 * `FlatList.onEndReached` for content that lives inside a plain ScrollView.
 *
 * Profile tabs, the circle editor and the Trakt import list all render inside
 * a parent ScrollView they do not own, so they cannot use a list's own
 * end-reached callback. This container watches its scroll offset and content
 * size and notifies every `useEndReached` subscriber when the viewport comes
 * within `threshold` screen-heights of the bottom. Like FlatList it fires once
 * per approach: it re-arms when the reader scrolls back out of the zone or
 * when the content changes size (a page appended), so a short first page keeps
 * loading until the screen is filled or the data runs out. Subscribers guard
 * with `hasNextPage && !isFetchingNextPage`, which is what stops the chain.
 *
 * Two ways to listen: a child component calls `useEndReached`, or the screen
 * that renders this container passes `onEndReached` directly. The hook only
 * works below the container in the tree, so the component that owns the
 * container must use the prop.
 */
export function EndReachedScrollView({
	threshold = 0.5,
	scrollEventThrottle = 32,
	onEndReached,
	onScroll,
	onLayout,
	onContentSizeChange,
	children,
	...props
}: ScrollViewProps & {
	/** Distance from the bottom, in viewport heights, that counts as the end. */
	threshold?: number;
	/** Called on each approach to the end, alongside `useEndReached` subscribers. */
	onEndReached?: () => void;
	children?: ReactNode;
}) {
	const listeners = useRef(new Set<Listener>());
	const viewportHeight = useRef(0);
	const contentHeight = useRef(0);
	const offsetY = useRef(0);
	const armed = useRef(true);
	const latestOnEndReached = useRef(onEndReached);
	latestOnEndReached.current = onEndReached;

	const evaluate = useCallback(() => {
		// Nothing to judge until both the viewport and the content are measured.
		if (viewportHeight.current === 0 || contentHeight.current === 0) return;
		const remaining =
			contentHeight.current - (offsetY.current + viewportHeight.current);
		const nearEnd = remaining <= viewportHeight.current * threshold;
		if (nearEnd && armed.current) {
			armed.current = false;
			latestOnEndReached.current?.();
			for (const listener of listeners.current) listener();
		} else if (!nearEnd) {
			armed.current = true;
		}
	}, [threshold]);

	const context = useMemo(
		() => ({
			subscribe(listener: Listener) {
				listeners.current.add(listener);
				return () => {
					listeners.current.delete(listener);
				};
			},
		}),
		[],
	);

	return (
		<EndReachedContext.Provider value={context}>
			<ScrollView
				{...props}
				scrollEventThrottle={scrollEventThrottle}
				onLayout={(event: LayoutChangeEvent) => {
					viewportHeight.current = event.nativeEvent.layout.height;
					onLayout?.(event);
					evaluate();
				}}
				onContentSizeChange={(width, height) => {
					// Content changed size (a page appended, a tab switched, or a loading
					// skeleton replaced by a shorter first page): arm again so a
					// still-short list keeps filling the screen. Shrinking counts too,
					// otherwise a skeleton taller than the data it stands in for would
					// consume the only shot and leave the list stuck on page one.
					if (height !== contentHeight.current) armed.current = true;
					contentHeight.current = height;
					onContentSizeChange?.(width, height);
					evaluate();
				}}
				onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
					offsetY.current = event.nativeEvent.contentOffset.y;
					onScroll?.(event);
					evaluate();
				}}
			>
				{children}
			</ScrollView>
		</EndReachedContext.Provider>
	);
}

/**
 * Run `callback` whenever the enclosing `EndReachedScrollView` nears its end.
 * A no-op outside one, so a component can also be hosted by a list that has
 * its own `onEndReached`. That also means the component rendering the
 * container cannot use this hook for itself: it passes `onEndReached` instead.
 * The latest callback is always used; the subscription itself is stable
 * across renders.
 */
export function useEndReached(callback: Listener) {
	const context = useContext(EndReachedContext);
	const latest = useRef(callback);
	latest.current = callback;

	useEffect(() => {
		if (!context) return;
		return context.subscribe(() => latest.current());
	}, [context]);
}
