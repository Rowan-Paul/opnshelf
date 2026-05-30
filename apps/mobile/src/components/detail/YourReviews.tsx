import type { MediaReviewItemDto } from "@opnshelf/api";
import { MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { ReviewEditorSheet } from "@/components/detail/ReviewEditorSheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useReview } from "@/lib/use-review";

interface YourReviewsProps {
	mediaType: "movie" | "show";
	mediaId: string;
}

/**
 * "Your Reviews" section for a media detail screen: lists every review the
 * current user has written for this title (reviews are zero-or-many per item)
 * and lets them write a new one or edit/delete an existing one. Mirrors the
 * web `ReviewSection`. The star rating is handled separately in
 * `MediaTrackingActions`.
 */
export function YourReviews({ mediaType, mediaId }: YourReviewsProps) {
	const { isAuthenticated } = useAuth();
	const {
		reviews,
		isLoading,
		createReview,
		updateReview,
		deleteReview,
		isSavingReview,
		isDeletingReview,
	} = useReview({ mediaType, mediaId });

	const [editorVisible, setEditorVisible] = useState(false);
	const [editing, setEditing] = useState<MediaReviewItemDto | null>(null);

	if (!isAuthenticated) return null;

	const openCreate = () => {
		setEditing(null);
		setEditorVisible(true);
	};

	const openEdit = (review: MediaReviewItemDto) => {
		setEditing(review);
		setEditorVisible(true);
	};

	const handleSave = (input: { title: string; markdown: string }) => {
		if (editing) updateReview(editing.id, input);
		else createReview(input);
		setEditorVisible(false);
	};

	const handleDelete = () => {
		if (editing) deleteReview(editing.id);
		setEditorVisible(false);
	};

	return (
		<View className="gap-3 px-4">
			<View className="flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<MessageSquarePlus color="#f3bc00" size={18} />
					<Text className="font-display font-semibold text-base text-foreground">
						Your Reviews
					</Text>
				</View>
				<Pressable
					onPress={openCreate}
					className="flex-row items-center gap-1 rounded-lg border border-border px-3 py-1.5"
				>
					<Plus color="#94a3b8" size={16} />
					<Text className="font-medium text-foreground text-sm">Write</Text>
				</Pressable>
			</View>

			{isLoading ? (
				<View className="flex-row items-center gap-2 py-2">
					<ActivityIndicator size="small" />
					<Text className="text-muted-foreground text-sm">
						Loading reviews…
					</Text>
				</View>
			) : reviews.length === 0 ? (
				<Text className="text-muted-foreground text-sm">
					No reviews yet. Share your thoughts on this title.
				</Text>
			) : (
				<View className="gap-3">
					{reviews.map((review) => (
						<View
							key={review.id}
							className="gap-1 rounded-xl border border-border bg-card p-3"
						>
							<View className="flex-row items-start justify-between gap-2">
								<Text className="flex-1 font-medium text-foreground text-sm">
									{review.title}
								</Text>
								<View className="flex-row gap-1">
									<Pressable
										hitSlop={8}
										onPress={() => openEdit(review)}
										className="h-7 w-7 items-center justify-center rounded-md"
									>
										<Pencil color="#94a3b8" size={16} />
									</Pressable>
									<Pressable
										hitSlop={8}
										onPress={() => {
											setEditing(review);
											deleteReview(review.id);
										}}
										disabled={isDeletingReview}
										className="h-7 w-7 items-center justify-center rounded-md"
										style={{ opacity: isDeletingReview ? 0.5 : 1 }}
									>
										<Trash2 color="#ef4444" size={16} />
									</Pressable>
								</View>
							</View>
							{review.description || review.markdown ? (
								<Text
									numberOfLines={3}
									className="text-muted-foreground text-sm leading-5"
								>
									{review.description ?? review.markdown}
								</Text>
							) : null}
						</View>
					))}
				</View>
			)}

			<ReviewEditorSheet
				visible={editorVisible}
				onDismiss={() => setEditorVisible(false)}
				isEditing={!!editing}
				initialTitle={editing?.title ?? ""}
				initialMarkdown={editing?.markdown ?? ""}
				onSave={handleSave}
				onDelete={editing ? handleDelete : undefined}
				isSaving={isSavingReview}
				isDeleting={isDeletingReview}
			/>
		</View>
	);
}
