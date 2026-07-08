import {
	reviewsControllerDeleteReviewMutation,
	reviewsControllerGetUserReviewsQueryKey,
	reviewsControllerUpdateReviewMutation,
	type UserReviewDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Star, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { ReviewEditorSheet } from "@/components/detail/ReviewEditorSheet";
import { ProfileContentCard } from "@/components/profile/ProfileContentCard";
import { ReviewBody } from "@/components/ReviewBody";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { mediaHref } from "@/lib/media-href";
import { useProfileReviews } from "@/lib/use-public-profile";

/**
 * Reviews tab: the user's reviews, cursor-paginated with a Load more button.
 * Renders the markdown body via the shared mobile Markdown renderer. The owner
 * can edit (review editor sheet) and delete each review, mirroring the web
 * Reviews page.
 *
 * `showHeading` is off for the full-screen drill-down route, where the native
 * stack header already shows "Reviews" (avoids a duplicate title); it stays on
 * inside the tabbed profile hub where the section needs its own label.
 */
export function ReviewsTab({
	userDid,
	isOwner,
	showHeading = true,
}: {
	userDid: string;
	isOwner: boolean;
	showHeading?: boolean;
}) {
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const { data, isLoading, isError } = useProfileReviews(userDid, cursor);

	const reviews = data?.items ?? [];
	const hasMore = data?.nextCursor != null;

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			{showHeading ? (
				<Text className="font-bold font-display text-2xl text-foreground">
					Reviews
				</Text>
			) : null}

			{isLoading ? (
				<View className="py-16">
					<ActivityIndicator color="#f3bc00" />
				</View>
			) : isError ? (
				<ErrorState message="Couldn't load reviews." />
			) : reviews.length === 0 ? (
				<EmptyState
					icon={Star}
					title={isOwner ? "No reviews yet" : "No reviews"}
				/>
			) : (
				<View className="gap-3">
					{reviews.map((review) => (
						<ReviewCard
							key={review.id}
							review={review}
							isOwner={isOwner}
							userDid={userDid}
						/>
					))}
				</View>
			)}

			{hasMore ? (
				<Pressable
					onPress={() => setCursor(data?.nextCursor ?? undefined)}
					className="items-center rounded-lg border border-border py-2.5"
				>
					<Text className="font-medium text-foreground text-sm">Load more</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function ReviewCard({
	review,
	isOwner,
	userDid,
}: {
	review: UserReviewDto;
	isOwner: boolean;
	userDid: string;
}) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const [editorVisible, setEditorVisible] = useState(false);

	const updateMutation = useMutation({
		mutationKey: ["reviews", review.id, "update"],
		...reviewsControllerUpdateReviewMutation(),
	});
	const deleteMutation = useMutation({
		mutationKey: ["reviews", review.id, "delete"],
		...reviewsControllerDeleteReviewMutation(),
	});

	const invalidateList = () =>
		queryClient.invalidateQueries({
			queryKey: reviewsControllerGetUserReviewsQueryKey({
				path: { userDid },
				query: { limit: 20 },
			}),
		});

	const handleSave = ({
		title,
		markdown,
	}: {
		title: string;
		markdown: string;
	}) => {
		updateMutation.mutate(
			{ path: { reviewId: review.id }, body: { title, markdown } },
			{
				onSuccess: () => {
					setEditorVisible(false);
					invalidateList();
					toast.success("Review saved");
				},
				onError: () => toast.error("Failed to save review"),
			},
		);
	};

	const performDelete = () => {
		deleteMutation.mutate(
			{ path: { reviewId: review.id } },
			{
				onSuccess: () => {
					invalidateList();
					toast.success("Review deleted");
				},
				onError: () => toast.error("Failed to delete review"),
			},
		);
	};

	const confirmDelete = () =>
		Alert.alert(
			"Delete review?",
			`This permanently deletes your review for "${review.title || "this title"}". This can't be undone.`,
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Delete", style: "destructive", onPress: performDelete },
			],
		);

	return (
		<>
			<ProfileContentCard
				posterUrl={
					review.posterPath
						? `https://image.tmdb.org/t/p/w300${review.posterPath}`
						: undefined
				}
				href={mediaHref({ ...review, reviewId: review.id })}
				title={review.title || "Unknown"}
				meta={new Date(review.createdAt).toLocaleDateString()}
				headerRight={
					isOwner ? (
						<View className="flex-row gap-1">
							<Pressable
								hitSlop={8}
								onPress={(e) => {
									e.stopPropagation();
									setEditorVisible(true);
								}}
								className="size-8 items-center justify-center rounded-md"
							>
								<Pencil color="#6b7280" size={16} />
							</Pressable>
							<Pressable
								hitSlop={8}
								disabled={deleteMutation.isPending}
								onPress={(e) => {
									e.stopPropagation();
									confirmDelete();
								}}
								className="size-8 items-center justify-center rounded-md"
							>
								{deleteMutation.isPending ? (
									<ActivityIndicator size="small" color="#ef4444" />
								) : (
									<Trash2 color="#ef4444" size={16} />
								)}
							</Pressable>
						</View>
					) : undefined
				}
			>
				{review.reviewTitle ? (
					<Text className="font-medium text-foreground text-sm">
						{review.reviewTitle}
					</Text>
				) : null}
				{review.markdown ? <ReviewBody markdown={review.markdown} /> : null}
			</ProfileContentCard>

			{isOwner ? (
				<ReviewEditorSheet
					visible={editorVisible}
					onDismiss={() => setEditorVisible(false)}
					isEditing
					initialTitle={review.reviewTitle ?? ""}
					initialMarkdown={review.markdown ?? ""}
					onSave={handleSave}
					onDelete={() => {
						setEditorVisible(false);
						confirmDelete();
					}}
					isSaving={updateMutation.isPending}
					isDeleting={deleteMutation.isPending}
				/>
			) : null}
		</>
	);
}
