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
	bottom,
	onDismiss,
}: {
	toast: ToastState;
	index: number;
	bottom: number;
	onDismiss: (id: number) => void;
}) {
	const opacity = useRef(new Animated.Value(0)).current;

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
			style={{
				bottom: bottom + index * 66,
				left: 16,
				opacity,
				position: "absolute",
				right: 16,
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
					bottom={insets.bottom + 72}
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
