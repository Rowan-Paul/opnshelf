import { useWindowDimensions } from "react-native";

/**
 * Number of columns for media-card grids (movie/show posters).
 *
 * Breakpoints are tuned for phones, unfolded foldables, and tablets:
 * - < 600 dp: phone (3 columns)
 * - 600–899 dp: large phone / folded-open foldable (4 columns)
 * - 900–1199 dp: tablet portrait / small tablet (5 columns)
 * - >= 1200 dp: tablet landscape / large tablet (6 columns)
 */
export function useMediaCardColumns(): number {
	const { width } = useWindowDimensions();

	if (width >= 1200) return 6;
	if (width >= 900) return 5;
	if (width >= 600) return 4;
	return 3;
}
