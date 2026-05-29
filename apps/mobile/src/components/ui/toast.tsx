import { Check, X } from "lucide-react-native";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";

type ToastVariant = "success" | "error";

interface ToastState {
	id: number;
	message: string;
	variant: ToastVariant;
}

interface ToastContextValue {
	/** Show a toast. Defaults to the success variant. */
	show: (message: string, variant?: ToastVariant) => void;
	success: (message: string) => void;
	error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Auto-dismiss delay for a toast, in milliseconds. */
const TOAST_DURATION = 2600;

/**
 * Minimal themed toast. There is no toast library in the mobile app, so this is
 * a lightweight inline implementation: a single animated banner pinned to the
 * bottom safe area. Mutations call `useToast().success/error(...)` for feedback.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastState | null>(null);
	const opacity = useRef(new Animated.Value(0)).current;
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const insets = useSafeAreaInsets();

	const dismiss = useCallback(() => {
		Animated.timing(opacity, {
			toValue: 0,
			duration: 180,
			useNativeDriver: true,
		}).start(() => setToast(null));
	}, [opacity]);

	const show = useCallback(
		(message: string, variant: ToastVariant = "success") => {
			if (timer.current) clearTimeout(timer.current);
			setToast({ id: Date.now(), message, variant });
			Animated.timing(opacity, {
				toValue: 1,
				duration: 180,
				useNativeDriver: true,
			}).start();
			timer.current = setTimeout(dismiss, TOAST_DURATION);
		},
		[dismiss, opacity],
	);

	useEffect(() => {
		return () => {
			if (timer.current) clearTimeout(timer.current);
		};
	}, []);

	const value: ToastContextValue = {
		show,
		success: (message) => show(message, "success"),
		error: (message) => show(message, "error"),
	};

	return (
		<ToastContext.Provider value={value}>
			{children}
			{toast ? (
				<Animated.View
					pointerEvents="box-none"
					style={{
						bottom: insets.bottom + 72,
						left: 16,
						opacity,
						position: "absolute",
						right: 16,
					}}
				>
					<Pressable
						onPress={dismiss}
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
					</Pressable>
				</Animated.View>
			) : null}
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
