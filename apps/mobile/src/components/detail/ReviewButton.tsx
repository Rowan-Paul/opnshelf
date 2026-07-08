import { MessageSquare } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ReviewEditorSheet } from "@/components/detail/ReviewEditorSheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useReview } from "@/lib/use-review";

/**
 * "Review" action for media detail screens. Opens the review editor so the
 * user can add a new long-form review without scrolling to the Community
 * Reviews section. Mirrors the compact tile style of RatingButton / NoteButton.
 */
export function ReviewButton({
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
	const { reviews, createReview, isSavingReview } = useReview({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const [sheetVisible, setSheetVisible] = useState(false);

	if (!isAuthenticated) return null;

	const hasReview = reviews.length > 0;

	const handleSave = (input: {
		title: string;
		markdown: string;
		mirrorToBlog: boolean;
	}) => {
		createReview(input);
		setSheetVisible(false);
	};

	return (
		<View className="flex-1">
			<Pressable
				onPress={() => setSheetVisible(true)}
				className="items-center justify-center gap-1 rounded-lg border border-border px-1 py-2.5"
			>
				<MessageSquare
					color={hasReview ? "#f3bc00" : "#94a3b8"}
					fill={hasReview ? "#f3bc00" : "transparent"}
					size={18}
				/>
				<Text className="font-medium text-foreground text-xs" numberOfLines={1}>
					Review
				</Text>
			</Pressable>

			<ReviewEditorSheet
				visible={sheetVisible}
				onDismiss={() => setSheetVisible(false)}
				isEditing={false}
				initialTitle=""
				initialMarkdown=""
				onSave={handleSave}
				isSaving={isSavingReview}
			/>
		</View>
	);
}
