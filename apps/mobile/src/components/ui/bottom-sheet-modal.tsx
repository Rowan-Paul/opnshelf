import {
	type ComponentProps,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Modal, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { ToastHost } from "@/components/ui/toast-host";

const OPEN_MS = 300;
const CLOSE_MS = 250;

/**
 * Transparent `<Modal>` for bottom sheets: the screen behind dims with a fade
 * while the sheet slides up, like the centred dialogs' backdrop.
 *
 * RN's `animationType="slide"` moves the whole Modal, so a backdrop inside it
 * would rise with the sheet. Here the Modal itself does not animate: the dim
 * fades and `children` slide, and on close the Modal stays up until both have
 * finished; open another sheet from `onClosed`, since one presented on top
 * would be dismissed with it on iOS. `children` keep their own layout: a `flex-1 justify-end` column
 * with a dismissing `Pressable` above the sheet. Toasts shown while it is open
 * render inside it, since the Modal covers the app's own toast stack.
 */
export function BottomSheetModal({
	visible,
	onRequestClose,
	onClosed,
	children,
	...modalProps
}: Omit<ComponentProps<typeof Modal>, "transparent" | "animationType"> & {
	visible: boolean;
	onRequestClose: () => void;
	/** Called once the close animation has finished and the Modal is gone. */
	onClosed?: () => void;
	children: ReactNode;
}) {
	const [mounted, setMounted] = useState(visible);
	const progress = useSharedValue(0);
	// The slide distance is the Modal's own height, so the sheet starts just
	// below the screen; it stays invisible for the frame before that is known.
	const height = useSharedValue(0);
	// iOS presents the Modal's window a few frames after it mounts, so the
	// slide waits for `onShow`; a sheet reopened while closing is still shown.
	const presented = useRef(false);
	const wasOpen = useRef(visible);
	const closed = useRef(onClosed);
	closed.current = onClosed;
	const open = useCallback(() => {
		progress.value = withTiming(1, {
			duration: OPEN_MS,
			easing: Easing.out(Easing.cubic),
		});
	}, [progress]);

	useEffect(() => {
		if (visible) {
			setMounted(true);
			wasOpen.current = true;
			if (presented.current) open();
			return;
		}
		progress.value = withTiming(0, {
			duration: CLOSE_MS,
			easing: Easing.in(Easing.cubic),
		});
		// Reopening before the close finishes clears this, keeping the sheet up.
		const timer = setTimeout(() => {
			presented.current = false;
			setMounted(false);
			if (wasOpen.current) {
				wasOpen.current = false;
				closed.current?.();
			}
		}, CLOSE_MS);
		return () => clearTimeout(timer);
	}, [visible, progress, open]);

	const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
	const sheetStyle = useAnimatedStyle(() => ({
		opacity: height.value ? 1 : 0,
		transform: [{ translateY: (1 - progress.value) * height.value }],
	}));

	return (
		<Modal
			{...modalProps}
			visible={mounted}
			transparent
			animationType="none"
			onRequestClose={onRequestClose}
			onShow={(event) => {
				presented.current = true;
				open();
				modalProps.onShow?.(event);
			}}
		>
			<Animated.View
				pointerEvents="none"
				style={[{ position: "absolute", inset: 0 }, backdropStyle]}
			>
				<View className="flex-1 bg-black/50" />
			</Animated.View>
			<Animated.View
				style={[{ flex: 1 }, sheetStyle]}
				onLayout={(event) => {
					height.value = event.nativeEvent.layout.height;
				}}
			>
				{children}
			</Animated.View>
			<ToastHost />
		</Modal>
	);
}
