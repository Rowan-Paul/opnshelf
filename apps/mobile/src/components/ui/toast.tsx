import { Check, X } from "lucide-react-native";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";

type ToastVariant = "success" | "error";

export interface ToastOptions {
	action?: {
		label: string;
		onPress: () => void;
	};
	duration?: number;
}

interface ToastState extends ToastOptions {
	id: number;
	message: string;
	variant: ToastVariant;
}

interface ToastContextValue {
	/** Show a toast. Defaults to the success variant. */
	show: (
		message: string,
		variant?: ToastVariant,
		options?: ToastOptions,
	) => void;
	success: (message: string, options?: ToastOptions) => void;
	error: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_DURATION = 3600;

function ToastItem({
	toast,
	index,
	top,
	onDismiss,
}: {
	toast: ToastState;
	index: number;
	top: number;
	onDismiss: (id: number) => void;
}) {
	const opacity = useRef(new Animated.Value(0)).current;
	const translateY = useRef(new Animated.Value(0)).current;

	// Swipe up to dismiss. PanResponder over Reanimated: the fade already runs on
	// Animated, and only a drag past the threshold claims the touch, so the tap
	// and the action button keep working.
	const pan = useMemo(
		() =>
			PanResponder.create({
				onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy < -6,
				onPanResponderMove: (_event, gesture) =>
					translateY.setValue(Math.min(0, gesture.dy)),
				onPanResponderRelease: (_event, gesture) => {
					if (gesture.dy < -40) {
						Animated.parallel([
							Animated.timing(translateY, {
								toValue: -80,
								duration: 140,
								useNativeDriver: true,
							}),
							Animated.timing(opacity, {
								toValue: 0,
								duration: 140,
								useNativeDriver: true,
							}),
						]).start(() => onDismiss(toast.id));
						return;
					}
					Animated.spring(translateY, {
						toValue: 0,
						useNativeDriver: true,
					}).start();
				},
			}),
		[onDismiss, opacity, toast.id, translateY],
	);

	useEffect(() => {
		Animated.timing(opacity, {
			toValue: 1,
			duration: 180,
			useNativeDriver: true,
		}).start();
		const timer = setTimeout(
			() => onDismiss(toast.id),
			toast.duration ?? TOAST_DURATION,
		);
		return () => clearTimeout(timer);
	}, [onDismiss, opacity, toast.duration, toast.id]);

	return (
		<Animated.View
			{...pan.panHandlers}
			style={{
				left: 16,
				opacity,
				position: "absolute",
				right: 16,
				top: top + index * 66,
				transform: [{ translateY }],
			}}
		>
			<Pressable
				onPress={() => onDismiss(toast.id)}
				className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
			>
				<View
					className={
						toast.variant === "success"
							? "rounded-full bg-primary/20 p-1"
							: "rounded-full bg-destructive/20 p-1"
					}
				>
					{toast.variant === "success" ? (
						<Check color="#22c55e" size={14} />
					) : (
						<X color="#ef4444" size={14} />
					)}
				</View>
				<Text className="flex-1 font-medium text-foreground text-sm">
					{toast.message}
				</Text>
				{toast.action ? (
					<Pressable
						onPress={() => {
							toast.action?.onPress();
							onDismiss(toast.id);
						}}
						className="rounded-lg bg-background-subtle px-2.5 py-1.5"
					>
						<Text className="font-semibold text-primary text-xs">
							{toast.action.label}
						</Text>
					</Pressable>
				) : null}
			</Pressable>
		</Animated.View>
	);
}

/** Minimal themed toast stack with optional actions. */
export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastState[]>([]);
	const nextId = useRef(1);
	const insets = useSafeAreaInsets();

	const dismiss = useCallback((id: number) => {
		setToasts((current) => current.filter((toast) => toast.id !== id));
	}, []);

	const show = useCallback(
		(
			message: string,
			variant: ToastVariant = "success",
			options: ToastOptions = {},
		) => {
			const id = nextId.current++;
			setToasts((current) => [
				...current.slice(-2),
				{ id, message, variant, ...options },
			]);
		},
		[],
	);

	const value: ToastContextValue = {
		show,
		success: (message, options) => show(message, "success", options),
		error: (message, options) => show(message, "error", options),
	};

	return (
		<ToastContext.Provider value={value}>
			{children}
			{toasts.map((toast, index) => (
				<ToastItem
					key={toast.id}
					toast={toast}
					index={index}
					// Below the status bar, and clear of the sheets that slide up from
					// the bottom.
					top={insets.top + 12}
					onDismiss={dismiss}
				/>
			))}
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
}
