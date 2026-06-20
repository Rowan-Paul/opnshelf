import { Star } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { RatingSheet } from "@/components/detail/RatingSheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useReview } from "@/lib/use-review";

/**
 * "Rate" action for media detail screens. Mirrors the `AddToListButton` pattern:
 * a single outlined button that opens a sheet, keeping the rating control out of
 * the page's primary surface. Shows the current rating inline when set.
 */
export function RatingButton({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}) {
	const { isAuthenticated } = useAuth();
	const [sheetVisible, setSheetVisible] = useState(false);
	const { rating, setRating, clearRating, isClearingRating } = useReview({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	if (!isAuthenticated) return null;

	const rated = rating > 0;

	return (
		<View className="px-4">
			<Pressable
				onPress={() => setSheetVisible(true)}
				className="flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
			>
				<Star
					color={rated ? "#f3bc00" : "#94a3b8"}
					fill={rated ? "#f3bc00" : "transparent"}
					size={18}
				/>
				<Text className="font-semibold text-foreground">
					{rated ? `Rated ${(rating / 2).toFixed(1)} / 5` : "Rate"}
				</Text>
			</Pressable>

			<RatingSheet
				visible={sheetVisible}
				onDismiss={() => setSheetVisible(false)}
				rating={rating}
				onChange={setRating}
				onClear={clearRating}
				isClearing={isClearingRating}
			/>
		</View>
	);
}
