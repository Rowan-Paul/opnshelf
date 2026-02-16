import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { Animated, Text, StyleSheet, View, Dimensions, PanResponder } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/theme";
import { m3BorderRadius } from "@/constants/material-theme";

export interface M3SnackbarProps {
	message: string;
	type?: "success" | "error" | "info";
}

interface SnackbarItem {
	id: string;
	message: string;
	type?: "success" | "error" | "info";
}

interface SnackbarContextType {
	showSnackbar: (message: string, type?: "success" | "error" | "info") => void;
}

const SnackbarContext = createContext<SnackbarContextType | null>(null);
const { width: SCREEN_WIDTH } = Dimensions.get("window");

function SnackbarItemComponent({ item, onDismiss }: { item: SnackbarItem; onDismiss: () => void }) {
	const { colors } = useTheme();
	const slideAnim = useRef(new Animated.Value(100)).current;
	const opacityAnim = useRef(new Animated.Value(0)).current;
	const panAnim = useRef(new Animated.Value(0)).current;

	const getColorsForType = () => {
		switch (item.type) {
			case "success":
				return {
					backgroundColor: colors.inverseSurface,
					textColor: colors.onInverseSurface,
				};
			case "error":
				return {
					backgroundColor: colors.errorContainer,
					textColor: colors.onErrorContainer,
				};
			default:
				return {
					backgroundColor: colors.inverseSurface,
					textColor: colors.onInverseSurface,
				};
		}
	};

	const config = getColorsForType();

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
				styles.snackbar,
				{
					backgroundColor: config.backgroundColor,
					transform: [{ translateY: slideAnim }, { translateY: panAnim }],
					opacity: opacityAnim,
				},
			]}
		>
			<Text style={[styles.message, { color: config.textColor }]}>
				{item.message}
			</Text>
		</Animated.View>
	);
}

interface M3SnackbarProviderProps {
	children: ReactNode;
}

export function M3SnackbarProvider({ children }: M3SnackbarProviderProps) {
	const [snackbars, setSnackbars] = useState<SnackbarItem[]>([]);
	const insets = useSafeAreaInsets();

	const showSnackbar = useCallback(
		(message: string, type: "success" | "error" | "info" = "info") => {
			const id = Math.random().toString(36).substring(7);
			setSnackbars((prev) => [...prev, { id, message, type }]);
		},
		[],
	);

	const removeSnackbar = useCallback((id: string) => {
		setSnackbars((prev) => prev.filter((snackbar) => snackbar.id !== id));
	}, []);

	return (
		<SnackbarContext.Provider value={{ showSnackbar }}>
			{children}
			<View
				style={[styles.container, { bottom: insets.bottom + 16 }]}
				pointerEvents="box-none"
			>
				{snackbars.map((snackbar) => (
					<SnackbarItemComponent
						key={snackbar.id}
						item={snackbar}
						onDismiss={() => removeSnackbar(snackbar.id)}
					/>
				))}
			</View>
		</SnackbarContext.Provider>
	);
}

export function useSnackbar() {
	const context = useContext(SnackbarContext);
	if (!context) {
		throw new Error("useSnackbar must be used within a M3SnackbarProvider");
	}
	return context;
}

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		left: 16,
		right: 16,
		alignItems: "center",
		zIndex: 9999,
		pointerEvents: "box-none",
	},
	snackbar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
		marginBottom: 8,
		borderRadius: m3BorderRadius.extraSmall,
		minWidth: SCREEN_WIDTH * 0.8,
		maxWidth: SCREEN_WIDTH - 32,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.25,
		shadowRadius: 6,
		elevation: 3,
	},
	message: {
		fontSize: 14,
		flex: 1,
	},
});
