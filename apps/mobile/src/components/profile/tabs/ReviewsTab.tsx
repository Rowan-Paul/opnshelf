import type { UserReviewDto } from "@opnshelf/api";
import { Star } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { ProfileContentCard } from "@/components/profile/ProfileContentCard";
import { ReviewExcerpt } from "@/components/profile/ReviewExcerpt";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { mediaHref } from "@/lib/media-href";
import { useProfileReviews } from "@/lib/use-public-profile";

/**
 * Reviews tab: the user's reviews, cursor-paginated with a Load more button.
 * Renders the markdown body via the shared mobile Markdown renderer. Read-only
 * on mobile. Mirrors the web Reviews page layout.
 */
export function ReviewsTab({
	userDid,
	isOwner,
}: {
	userDid: string;
	isOwner: boolean;
}) {
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const { data, isLoading, isError } = useProfileReviews(userDid, cursor);

	const reviews = data?.items ?? [];
	const hasMore = data?.nextCursor != null;

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="font-bold font-display text-2xl text-foreground">
				Reviews
			</Text>

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
						<ReviewCard key={review.id} review={review} />
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

function ReviewCard({ review }: { review: UserReviewDto }) {
	return (
		<ProfileContentCard
			posterUrl={
				review.posterPath
					? `https://image.tmdb.org/t/p/w300${review.posterPath}`
					: undefined
			}
			href={mediaHref({ ...review, reviewId: review.id })}
			title={review.title || "Unknown"}
			meta={new Date(review.createdAt).toLocaleDateString()}
		>
			{review.reviewTitle ? (
				<Text className="font-medium text-foreground text-sm">
					{review.reviewTitle}
				</Text>
			) : null}
			{review.markdown ? (
				<ReviewExcerpt markdown={review.markdown} className="max-h-40" />
			) : null}
		</ProfileContentCard>
	);
}
