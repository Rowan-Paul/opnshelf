import type { MediaReviewItemDto } from "@opnshelf/api";
import { MessageSquare } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ReviewEditorSheet } from "@/components/detail/ReviewEditorSheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useReview } from "@/lib/use-review";

/** A single detail action for the independent rating and review records. */
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
		<View className="flex-1">
			<Pressable
				disabled={isLoading}
				onPress={() => {
					if (isReviewError) {
						void refetchReviews();
						return;
					}
					setEditingReview(reviews[0]);
					setSheetVisible(true);
				}}
				className="flex-1 items-center justify-center gap-1 rounded-lg border border-border px-1 py-2.5"
			>
				<MessageSquare
					color={hasActivity ? "#f3bc00" : "#94a3b8"}
					fill={hasActivity ? "#f3bc00" : "transparent"}
					size={18}
				/>
				<Text className="text-center font-medium text-foreground text-xs">
					{isReviewError ? "Retry reviews" : "Rate & review"}
				</Text>
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
