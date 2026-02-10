import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { Animated, Text, StyleSheet } from "react-native";
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

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<Toast | null>(null);
	const fadeAnim = useRef(new Animated.Value(0)).current;

	const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
		const id = Math.random().toString(36).substring(7);
		setToast({ id, message, type });

		Animated.sequence([
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}),
			Animated.delay(3000),
			Animated.timing(fadeAnim, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}),
		]).start(() => {
			setToast(null);
		});
	}, [fadeAnim]);

	const getBackgroundColor = (type: string) => {
		switch (type) {
			case "success":
				return "#166534";
			case "error":
				return "#991b1b";
			default:
				return "#1f2937";
		}
	};

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			{toast && (
				<Animated.View
					style={[
						styles.toastContainer,
						{ backgroundColor: getBackgroundColor(toast.type) },
						{ opacity: fadeAnim },
					]}
				>
					<Text style={styles.toastText}>{toast.message}</Text>
				</Animated.View>
			)}
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
		top: 60,
		left: 16,
		right: 16,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.lg,
		zIndex: 9999,
	},
	toastText: {
		color: colors.text,
		fontSize: 14,
		fontWeight: "500",
		textAlign: "center",
	},
});
