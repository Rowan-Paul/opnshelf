import { Heart, Loader2 } from "lucide-react";

/**
 * Heart + count for a Review Like. Shared by community review cards, the
 * Review page and the profile Reviews page. Only a signed-in viewer who is not
 * the author can toggle it; everyone else sees the read-only count.
 */
export function ReviewLikeButton({
	likeCount,
	isLiked,
	canLike,
	isAuthenticated,
	isPending,
	onToggle,
}: {
	/** `undefined` while the count is still loading: a placeholder holds its place. */
	likeCount: number | undefined;
	isLiked: boolean;
	canLike: boolean;
	isAuthenticated: boolean;
	isPending: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={() => {
				if (canLike && !isPending) onToggle();
			}}
			disabled={!canLike || isPending}
			className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors ${
				!canLike
					? "cursor-not-allowed text-(--foreground-muted) opacity-50"
					: isLiked
						? "text-destructive hover:bg-destructive/10"
						: "text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--accent)"
			}`}
			aria-label={
				!isAuthenticated
					? `${likeCount ?? 0} likes`
					: isLiked
						? "Unlike review"
						: "Like review"
			}
		>
			{isPending ? (
				<Loader2 className="size-4 animate-spin" />
			) : (
				<Heart className={`size-4 ${isLiked ? "fill-destructive" : ""}`} />
			)}
			{likeCount === undefined ? (
				<span className="h-3.5 w-3 animate-pulse rounded bg-(--background-subtle)" />
			) : (
				<span>{likeCount}</span>
			)}
		</button>
	);
}
