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
import {
	Heart,
	MessageSquare,
	Pencil,
	Plus,
	Trash2,
	User,
} from "lucide-react-native";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	type LayoutChangeEvent,
	Pressable,
	type ScrollView,
	View,
} from "react-native";
import { ReviewEditorSheet } from "@/components/detail/ReviewEditorSheet";
import { StarRating } from "@/components/detail/StarRating";
import { Markdown } from "@/components/ui/Markdown";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useReview } from "@/lib/use-review";
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
	isOwn,
	highlighted,
	onToggleLike,
	likePending,
	canLike,
	onEdit,
	onDelete,
	isDeleting,
}: {
	review: MediaReviewItemDto;
	avatarStyle: ReturnType<typeof useTwStyle>;
	isOwn: boolean;
	highlighted?: boolean;
	onToggleLike: () => void;
	likePending: boolean;
	canLike: boolean;
	onEdit: () => void;
	onDelete: () => void;
	isDeleting: boolean;
}) {
	const displayName = review.userDisplayName || review.userHandle;
	const body = review.markdown || review.description || "";
	const isLiked = review.hasLiked;

	return (
		<View
			className={
				highlighted
					? "gap-3 rounded-xl border-2 border-primary bg-card p-3"
					: isOwn
						? "gap-3 rounded-xl border border-primary/40 bg-card p-3"
						: "gap-3 rounded-xl border border-border bg-card p-3"
			}
		>
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
							<View className="flex-row items-center gap-2">
								<Text
									className="shrink font-medium text-foreground text-sm"
									numberOfLines={1}
								>
									{displayName}
								</Text>
								{isOwn ? (
									<View className="rounded-full bg-primary/20 px-1.5 py-0.5">
										<Text className="font-medium text-[10px] text-primary">
											Your review
										</Text>
									</View>
								) : null}
							</View>
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

			{isOwn ? (
				<View className="flex-row items-center gap-1">
					<Pressable
						hitSlop={6}
						onPress={onEdit}
						className="flex-row items-center gap-1.5 rounded-md px-2 py-1"
					>
						<Pencil color={MUTED} size={15} />
						<Text className="text-muted-foreground text-sm">Edit</Text>
					</Pressable>
					<Pressable
						hitSlop={6}
						onPress={onDelete}
						disabled={isDeleting}
						className="flex-row items-center gap-1.5 rounded-md px-2 py-1"
						style={{ opacity: isDeleting ? 0.5 : 1 }}
					>
						<Trash2 color={LIKE_RED} size={15} />
						<Text className="text-sm" style={{ color: LIKE_RED }}>
							Delete
						</Text>
					</Pressable>
				</View>
			) : (
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
			)}
		</View>
	);
}

/**
 * The single reviews section on a media detail screen. Mirrors the web
 * `CommunityReviews`: one list with the current user's own reviews first (badged
 * and editable/deletable) followed by everyone else's (likeable), plus a "Write"
 * action that opens the review editor. Uses the same `reviewsControllerGetMediaReviews`
 * query; writes go through `useReview`.
 */
export function CommunityReviews({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	scrollRef,
	focusReviewId,
}: CommunityReviewsProps & {
	/** Parent ScrollView, so a deep-linked review can be scrolled into view. */
	scrollRef?: RefObject<ScrollView | null>;
	/** Review to scroll to + highlight (from a `?reviewId=` deep link). */
	focusReviewId?: string;
}) {
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

	const {
		createReview,
		updateReview,
		deleteReview,
		isSavingReview,
		isDeletingReview,
	} = useReview({ mediaType, mediaId, seasonNumber, episodeNumber });

	const [editorVisible, setEditorVisible] = useState(false);
	const [editing, setEditing] = useState<MediaReviewItemDto | null>(null);

	// Own reviews first, then everyone else's — same ordering as web.
	const allReviews = data?.items ?? [];
	const ownReviews = allReviews.filter((r) => r.userDid === user?.did);
	const otherReviews = allReviews.filter((r) => r.userDid !== user?.did);
	const ordered = [...ownReviews, ...otherReviews];

	// Deep-link scroll: when arriving via `?reviewId=`, pin the reviews section
	// into view. The page above (cast, providers, …) loads async and shifts this
	// section's offset, so we re-scroll on each relayout for a short window, then
	// release control back to the user.
	const sectionY = useRef(0);
	const pinUntil = useRef(0);
	const hasFocusReview =
		focusReviewId != null && ordered.some((r) => r.id === focusReviewId);

	useEffect(() => {
		if (focusReviewId) pinUntil.current = Date.now() + 2500;
	}, [focusReviewId]);

	const handleSectionLayout = (e: LayoutChangeEvent) => {
		sectionY.current = e.nativeEvent.layout.y;
		if (hasFocusReview && Date.now() < pinUntil.current) {
			scrollRef?.current?.scrollTo({
				y: Math.max(0, sectionY.current - 12),
				animated: true,
			});
		}
	};

	const openCreate = () => {
		setEditing(null);
		setEditorVisible(true);
	};
	const openEdit = (review: MediaReviewItemDto) => {
		setEditing(review);
		setEditorVisible(true);
	};
	const handleSave = (input: {
		title: string;
		markdown: string;
		mirrorToBlog: boolean;
	}) => {
		if (editing) updateReview(editing.id, input);
		else createReview(input);
		setEditorVisible(false);
	};
	const handleDeleteFromEditor = () => {
		if (editing) deleteReview(editing.id);
		setEditorVisible(false);
	};

	return (
		<View className="gap-3 px-4" onLayout={handleSectionLayout}>
			<View className="flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<MessageSquare color={ACCENT} size={18} />
					<Text className="font-display font-semibold text-base text-foreground">
						Reviews
					</Text>
				</View>
				{isAuthenticated ? (
					<Pressable
						onPress={openCreate}
						className="flex-row items-center gap-1 rounded-lg border border-border px-3 py-1.5"
					>
						<Plus color={MUTED} size={16} />
						<Text className="font-medium text-foreground text-sm">Write</Text>
					</Pressable>
				) : null}
			</View>

			{isLoading ? (
				<View className="flex-row items-center gap-2 py-2">
					<ActivityIndicator size="small" />
					<Text className="text-muted-foreground text-sm">
						Loading reviews…
					</Text>
				</View>
			) : ordered.length === 0 ? (
				<Text className="text-muted-foreground text-sm">
					{isAuthenticated
						? "No reviews yet. Be the first to share your thoughts."
						: "No reviews yet."}
				</Text>
			) : (
				<View className="gap-3">
					{ordered.map((review) => {
						const isOwn = review.userDid === user?.did;
						return (
							<ReviewCard
								key={review.id}
								review={review}
								avatarStyle={avatarStyle}
								isOwn={isOwn}
								highlighted={review.id === focusReviewId}
								canLike={isAuthenticated}
								likePending={isPending}
								onToggleLike={() => {
									if (!isAuthenticated) return;
									if (review.hasLiked) unlikeReview(review.id);
									else likeReview(review.id);
								}}
								onEdit={() => openEdit(review)}
								onDelete={() => deleteReview(review.id)}
								isDeleting={isDeletingReview}
							/>
						);
					})}
				</View>
			)}

			<ReviewEditorSheet
				visible={editorVisible}
				onDismiss={() => setEditorVisible(false)}
				isEditing={!!editing}
				initialTitle={editing?.title ?? ""}
				initialMarkdown={editing?.markdown ?? ""}
				initialMirrorToBlog={editing?.mirrorToBlog ?? true}
				onSave={handleSave}
				onDelete={editing ? handleDeleteFromEditor : undefined}
				isSaving={isSavingReview}
				isDeleting={isDeletingReview}
			/>
		</View>
	);
}
