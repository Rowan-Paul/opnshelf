import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Keep two-column content readable when the window or text size changes. */
export function useWideLayout() {
	const { width, fontScale } = useWindowDimensions();
	const { left, right } = useSafeAreaInsets();
	return (width - left - right) / Math.max(1, fontScale) >= 768;
}

/** Place the gutter at the physical display midpoint, including asymmetric safe areas. */
export function usePaneWidth(horizontalPadding = 0) {
	const { width } = useWindowDimensions();
	const { left } = useSafeAreaInsets();
	return width / 2 - left - horizontalPadding - 12;
}
