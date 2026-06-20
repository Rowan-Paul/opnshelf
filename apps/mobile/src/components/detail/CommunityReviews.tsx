import {
	type MediaReviewItemDto,
	reviewsControllerGetMediaReviewsOptions,
	reviewsControllerGetMediaReviewsQueryKey,
	reviewsControllerLikeReviewMutation,
	reviewsControllerUnlikeReviewMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { type Href, Link } from "expo-router";
import { Heart, MessageSquare, User } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { StarRating } from "@/components/detail/StarRating";
import { Markdown } from "@/components/ui/Markdown";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useTwStyle } from "@/lib/use-tw-style";

const ACCENT = "#f3bc00";
const MUTED = "#94a3b8";
const LIKE_RED = "#ef4444";

interface CommunityReviewsProps {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

function resolveMediaType(
	mediaType: "movie" | "show",
	seasonNumber?: number,
	episodeNumber?: number,
): "movie" | "show" | "season" | "episode" {
	if (episodeNumber != null) return "episode";
	if (seasonNumber != null) return "season";
	return mediaType;
}

/**
 * Like / unlike toggle for review cards, mirroring web's `useToggleReviewLike`.
 * Both mutations invalidate the media-reviews query so `likeCount` / `hasLiked`
 * refresh from the server after a toggle.
 */
function useToggleReviewLike({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: CommunityReviewsProps) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const mediaReviewsKey = reviewsControllerGetMediaReviewsQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	const likeMutation = useMutation({
		mutationKey: [
			"reviews",
			resolvedMediaType,
			mediaId,
			seasonNumber ?? 0,
			episodeNumber ?? 0,
			"toggle-like",
		],
		...reviewsControllerLikeReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to like review",
			);
		},
	});

	const unlikeMutation = useMutation({
		mutationKey: [
			"reviews",
			resolvedMediaType,
			mediaId,
			seasonNumber ?? 0,
			episodeNumber ?? 0,
			"toggle-unlike",
		],
		...reviewsControllerUnlikeReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to unlike review",
			);
		},
	});

	return {
		likeReview: (reviewId: string) =>
			likeMutation.mutate({ path: { reviewId } }),
		unlikeReview: (reviewId: string) =>
			unlikeMutation.mutate({ path: { reviewId } }),
		isPending: likeMutation.isPending || unlikeMutation.isPending,
	};
}

function ReviewCard({
	review,
	avatarStyle,
	onToggleLike,
	likePending,
	canLike,
}: {
	review: MediaReviewItemDto;
	avatarStyle: ReturnType<typeof useTwStyle>;
	onToggleLike: () => void;
	likePending: boolean;
	canLike: boolean;
}) {
	const displayName = review.userDisplayName || review.userHandle;
	const body = review.markdown || review.description || "";
	const isLiked = review.hasLiked;

	return (
		<View className="gap-3 rounded-xl border border-border bg-card p-3">
			<View className="flex-row items-center gap-3">
				<Link href={`/profile/${review.userHandle}` as Href} asChild>
					<Pressable className="min-w-0 flex-1 flex-row items-center gap-3">
						<View className="size-10 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
							{review.userAvatar ? (
								<Image
									source={{ uri: review.userAvatar }}
									style={avatarStyle}
									contentFit="cover"
								/>
							) : (
								<User color={MUTED} size={18} />
							)}
						</View>
						<View className="min-w-0 flex-1">
							<Text
								className="font-medium text-foreground text-sm"
								numberOfLines={1}
							>
								{displayName}
							</Text>
							<Text className="text-muted-foreground text-xs" numberOfLines={1}>
								@{review.userHandle}
							</Text>
						</View>
					</Pressable>
				</Link>
				{review.authorRating != null && review.authorRating > 0 ? (
					<StarRating rating={review.authorRating} size={14} />
				) : null}
			</View>

			{review.title ? (
				<Text className="font-display font-semibold text-base text-foreground">
					{review.title}
				</Text>
			) : null}

			{body ? <Markdown value={body} /> : null}

			<View className="flex-row items-center">
				<Pressable
					onPress={onToggleLike}
					disabled={!canLike || likePending}
					hitSlop={8}
					className="flex-row items-center gap-1.5 rounded-md py-1 pr-2"
					style={{ opacity: !canLike || likePending ? 0.5 : 1 }}
				>
					{likePending ? (
						<ActivityIndicator size="small" color={LIKE_RED} />
					) : (
						<Heart
							color={isLiked ? LIKE_RED : MUTED}
							fill={isLiked ? LIKE_RED : "transparent"}
							size={16}
						/>
					)}
					<Text
						className="text-sm"
						style={{ color: isLiked ? LIKE_RED : MUTED }}
					>
						{review.likeCount}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

/**
 * "Community Reviews" section for a media detail screen: lists reviews written
 * by *other* users (the current user's own reviews are handled by the separate
 * `YourReviews` section). Mirrors the web `CommunityReviews`, using the same
 * `reviewsControllerGetMediaReviews` query and like/unlike mutations. Shows the
 * author, their star rating, the markdown body and a like toggle.
 */
export function CommunityReviews({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: CommunityReviewsProps) {
	const { user, isAuthenticated } = useAuth();
	const avatarStyle = useTwStyle("size-10");
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const { data, isLoading } = useQuery({
		...reviewsControllerGetMediaReviewsOptions({
			query: {
				mediaType: resolvedMediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
			},
		}),
		enabled: !!mediaId,
	});

	const { likeReview, unlikeReview, isPending } = useToggleReviewLike({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	// Other users' reviews only — the user's own reviews live in `YourReviews`.
	const communityReviews = (data?.items ?? []).filter(
		(review) => review.userDid !== user?.did,
	);

	return (
		<View className="gap-3 px-4">
			<View className="flex-row items-center gap-2">
				<MessageSquare color={ACCENT} size={18} />
				<Text className="font-display font-semibold text-base text-foreground">
					Community Reviews
				</Text>
			</View>

			{isLoading ? (
				<View className="flex-row items-center gap-2 py-2">
					<ActivityIndicator size="small" />
					<Text className="text-muted-foreground text-sm">
						Loading reviews…
					</Text>
				</View>
			) : communityReviews.length === 0 ? (
				<Text className="text-muted-foreground text-sm">No reviews yet.</Text>
			) : (
				<View className="gap-3">
					{communityReviews.map((review) => (
						<ReviewCard
							key={review.id}
							review={review}
							avatarStyle={avatarStyle}
							canLike={isAuthenticated}
							likePending={isPending}
							onToggleLike={() => {
								if (!isAuthenticated) return;
								if (review.hasLiked) unlikeReview(review.id);
								else likeReview(review.id);
							}}
						/>
					))}
				</View>
			)}
		</View>
	);
}
