import type { MediaReviewItemDto } from "@opnshelf/api";
import { MessageSquare, Star } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ReviewEditorSheet } from "@/components/detail/ReviewEditorSheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useReview } from "@/lib/use-review";
import { useThemeColors } from "@/theme/colors";

/**
 * A single detail action for the independent rating and review records: a
 * compact button in the shelf row showing the user's rating once there is one,
 * like web's `MediaActionsBar`.
 */
export function RateReviewButton({
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
	const colors = useThemeColors();
	const { isAuthenticated } = useAuth();
	const [sheetVisible, setSheetVisible] = useState(false);
	const [editingReview, setEditingReview] = useState<MediaReviewItemDto>();
	const {
		rating,
		reviews,
		setRating,
		clearRating,
		createReview,
		updateReview,
		isLoading,
		isReviewError,
		refetchReviews,
		isClearingRating,
		isSavingReview,
	} = useReview({ mediaType, mediaId, seasonNumber, episodeNumber });

	if (!isAuthenticated) return null;

	const hasActivity = rating > 0 || reviews.length > 0;

	const handleSave = (input: {
		title: string;
		markdown: string;
		mirrorToBlog: boolean;
		postToBluesky: boolean;
		spoiler: boolean;
	}) => {
		if (editingReview) updateReview(editingReview.id, input);
		else createReview(input);
		setSheetVisible(false);
	};

	return (
		<View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={
					rating > 0
						? `Your rating: ${rating} out of 10. Rate and review`
						: "Rate and review"
				}
				disabled={isLoading}
				onPress={() => {
					if (isReviewError) {
						void refetchReviews();
						return;
					}
					setEditingReview(reviews[0]);
					setSheetVisible(true);
				}}
				className="h-12 min-w-12 flex-row items-center justify-center gap-1 rounded-lg border border-border px-3"
			>
				{isReviewError ? (
					<Text className="font-medium text-foreground text-xs">Retry</Text>
				) : rating > 0 ? (
					<>
						<Star color={colors.accent} fill={colors.accent} size={16} />
						<Text className="font-medium text-foreground text-xs tabular-nums">
							{rating}/10
						</Text>
					</>
				) : (
					<MessageSquare
						color={hasActivity ? colors.accent : colors.mutedForeground}
						fill={hasActivity ? colors.accent : "transparent"}
						size={20}
					/>
				)}
			</Pressable>

			<ReviewEditorSheet
				visible={sheetVisible}
				onDismiss={() => setSheetVisible(false)}
				isEditing={!!editingReview}
				initialTitle={editingReview?.reviewTitle ?? ""}
				initialMarkdown={editingReview?.markdown ?? ""}
				initialSpoiler={editingReview?.spoiler ?? false}
				initialMirrorToBlog={editingReview?.mirrorToBlog ?? true}
				onNewReview={() => setEditingReview(undefined)}
				onSave={handleSave}
				isSaving={isSavingReview}
				rating={rating}
				onRatingChange={setRating}
				onClearRating={clearRating}
				isClearingRating={isClearingRating}
			/>
		</View>
	);
}
