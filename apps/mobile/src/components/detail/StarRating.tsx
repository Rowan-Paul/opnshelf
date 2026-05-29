import { Star, StarHalf } from "lucide-react-native";
import { Pressable, View } from "react-native";

const STAR_COLOR = "#f3bc00";
const EMPTY_COLOR = "#475569";

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

	return (
		<View className="flex-row gap-1">
			{stars.map((star) => {
				// Rating value covered by the full and half positions of this star.
				const fullValue = star * 2; // 2,4,6,8,10
				const halfValue = star * 2 - 1; // 1,3,5,7,9
				const isFull = rating >= fullValue;
				const isHalf = !isFull && rating >= halfValue;

				const icon = isFull ? (
					<Star color={STAR_COLOR} fill={STAR_COLOR} size={size} />
				) : isHalf ? (
					<StarHalf color={STAR_COLOR} fill={STAR_COLOR} size={size} />
				) : (
					<Star color={EMPTY_COLOR} size={size} />
				);

				if (!interactive) {
					return <View key={star}>{icon}</View>;
				}

				return (
					<View key={star} className="flex-row">
						{/* Left half -> half-star value */}
						<Pressable
							hitSlop={4}
							onPress={() => onChange?.(halfValue)}
							style={{ width: size / 2 }}
						>
							{icon}
						</Pressable>
						{/* Right half -> full-star value (overlaps the same icon) */}
						<Pressable
							hitSlop={4}
							onPress={() => onChange?.(fullValue)}
							style={{ marginLeft: -size / 2, width: size / 2 }}
						/>
					</View>
				);
			})}
		</View>
	);
}
