import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { Animated, Text, StyleSheet, View, Dimensions, PanResponder } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X, Info } from "lucide-react-native";
import { colors, spacing, borderRadius } from "@/constants/theme";

interface Toast {
	id: string;
	message: string;
	type: "success" | "error" | "info";
}

interface ToastContextType {
	showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextType | null>(null);
const { width: SCREEN_WIDTH } = Dimensions.get("window");

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
	const slideAnim = useRef(new Animated.Value(100)).current;
	const opacityAnim = useRef(new Animated.Value(0)).current;
	const panAnim = useRef(new Animated.Value(0)).current;

	const getToastConfig = (type: string) => {
		switch (type) {
			case "success":
				return {
					backgroundColor: "#ecfdf5",
					borderColor: "#22c55e",
					iconColor: "#16a34a",
					Icon: Check,
				};
			case "error":
				return {
					backgroundColor: "#fef2f2",
					borderColor: "#ef4444",
					iconColor: "#dc2626",
					Icon: X,
				};
			default:
				return {
					backgroundColor: "#f9fafb",
					borderColor: "#6b7280",
					iconColor: "#4b5563",
					Icon: Info,
				};
		}
	};

	const config = getToastConfig(toast.type);
	const IconComponent = config.Icon;

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onPanResponderMove: (_, gestureState) => {
				if (gestureState.dy > 0) {
					panAnim.setValue(gestureState.dy);
				}
			},
			onPanResponderRelease: (_, gestureState) => {
				if (gestureState.dy > 50) {
					Animated.timing(panAnim, {
						toValue: 200,
						duration: 150,
						useNativeDriver: true,
					}).start(onDismiss);
				} else {
					Animated.spring(panAnim, {
						toValue: 0,
						useNativeDriver: true,
						friction: 8,
					}).start();
				}
			},
		})
	).current;

	// Animate in on mount
	useEffect(() => {
		Animated.parallel([
			Animated.timing(slideAnim, {
				toValue: 0,
				duration: 300,
				useNativeDriver: true,
			}),
			Animated.timing(opacityAnim, {
				toValue: 1,
				duration: 300,
				useNativeDriver: true,
			}),
		]).start();
	}, []);

	// Auto dismiss after 4 seconds
	useEffect(() => {
		const timer = setTimeout(() => {
			Animated.parallel([
				Animated.timing(slideAnim, {
					toValue: 100,
					duration: 200,
					useNativeDriver: true,
				}),
				Animated.timing(opacityAnim, {
					toValue: 0,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start(onDismiss);
		}, 4000);
		return () => clearTimeout(timer);
	}, [onDismiss, slideAnim, opacityAnim]);

	return (
		<Animated.View
			{...panResponder.panHandlers}
			style={[
				styles.toastItem,
				{
					backgroundColor: config.backgroundColor,
					borderColor: config.borderColor,
					transform: [
						{ translateY: slideAnim },
						{ translateY: panAnim },
					],
					opacity: opacityAnim,
				},
			]}
		>
			<IconComponent size={20} color={config.iconColor} />
			<Text style={[styles.toastText, { color: colors.background }]}>
				{toast.message}
			</Text>
		</Animated.View>
	);
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const insets = useSafeAreaInsets();

	const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
		const id = Math.random().toString(36).substring(7);
		setToasts((prev) => [...prev, { id, message, type }]);
	}, []);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			<View style={[styles.toastContainer, { bottom: insets.bottom }]} pointerEvents="box-none">
				{toasts.map((toast) => (
					<ToastItem
						key={toast.id}
						toast={toast}
						onDismiss={() => removeToast(toast.id)}
					/>
				))}
			</View>
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

const styles = StyleSheet.create({
	toastContainer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		alignItems: "center",
		zIndex: 9999,
		pointerEvents: "box-none",
		paddingBottom: 80,
	},
	toastItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
		marginBottom: spacing.sm,
		borderRadius: borderRadius.xl,
		borderWidth: 1,
		minWidth: SCREEN_WIDTH * 0.8,
		maxWidth: SCREEN_WIDTH - 32,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 5,
	},
	toastText: {
		fontSize: 14,
		fontWeight: "500",
		flex: 1,
	},
});
