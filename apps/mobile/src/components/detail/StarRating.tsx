import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const STAR_COLOR = "#f3bc00";
const EMPTY_COLOR = "#94a3b8";

// Sharp 5-point star (viewBox 0 0 24 24). Drawn as a solid fill — no stroke —
// so it stays crisp at any size instead of the chunky stroked lucide icon.
const STAR_PATH =
	"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

/**
 * A single star filled `fraction` of the way (0, 0.5 or 1). The fill is a
 * second star layered over the muted base, clipped to a left-aligned
 * fractional-width overflow box — a clean partial fill without strokes or
 * per-instance clip-path ids.
 */
function StarIcon({ size, fraction }: { size: number; fraction: number }) {
	return (
		<View style={{ width: size, height: size }}>
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path d={STAR_PATH} fill={EMPTY_COLOR} />
			</Svg>
			{fraction > 0 ? (
				<View
					style={{
						position: "absolute",
						width: size * fraction,
						height: size,
						overflow: "hidden",
					}}
				>
					<Svg width={size} height={size} viewBox="0 0 24 24">
						<Path d={STAR_PATH} fill={STAR_COLOR} />
					</Svg>
				</View>
			) : null}
		</View>
	);
}

/**
 * Star rating display / input. The API stores ratings on a 1-10 scale that maps
 * to 0.5-5.0 stars, so each of the 5 stars covers 2 rating points (a tap on the
 * left half of a star sets the odd value, the right half the even value).
 *
 * When `onChange` is provided the stars are interactive; otherwise it renders a
 * read-only rating.
 */
export function StarRating({
	rating,
	onChange,
	size = 28,
}: {
	/** 1-10 scale (or 0 for unrated). */
	rating: number;
	onChange?: (rating: number) => void;
	size?: number;
}) {
	const stars = [1, 2, 3, 4, 5];
	const interactive = !!onChange;
	// Spacing scales with the star size so small read-only rows stay tight and
	// the large interactive control gets room to breathe.
	const gap = Math.max(2, Math.round(size * 0.18));

	return (
		<View style={{ flexDirection: "row", gap }}>
			{stars.map((star) => {
				// How much of this star is filled: 1 (full), 0.5 (half) or 0.
				const fraction = Math.max(0, Math.min(2, rating - (star - 1) * 2)) / 2;
				const halfValue = star * 2 - 1; // 1,3,5,7,9
				const fullValue = star * 2; // 2,4,6,8,10

				if (!interactive) {
					return (
						<View key={star}>
							<StarIcon size={size} fraction={fraction} />
						</View>
					);
				}

				return (
					<View key={star} style={{ width: size, height: size }}>
						<StarIcon size={size} fraction={fraction} />
						{/* Transparent tap targets over the star: left half sets the half
						    value, right half the full value. */}
						<View
							style={{
								position: "absolute",
								flexDirection: "row",
								width: size,
								height: size,
							}}
						>
							<Pressable
								hitSlop={6}
								onPress={() => onChange?.(halfValue)}
								style={{ width: size / 2, height: size }}
							/>
							<Pressable
								hitSlop={6}
								onPress={() => onChange?.(fullValue)}
								style={{ width: size / 2, height: size }}
							/>
						</View>
					</View>
				);
			})}
		</View>
	);
}
