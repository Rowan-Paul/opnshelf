import { Loader2, Star, StarOff, X } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	useClearRating,
	useRating,
	useSetRating,
} from "#/lib/hooks/useRatings";
import StarRating, { ratingToStars } from "./StarRating";

interface RatingDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

/**
 * Dialog for setting the current user's star rating. Ratings are set/clear on
 * a standalone `/ratings` resource (one per user per item) — separate from the
 * long-form reviews handled by `ReviewDialog`. Selecting a star saves
 * immediately (mirrors the mobile `RatingSheet`); a "Clear rating" action
 * removes it and closes the dialog.
 */
export function RatingDialog({
	open,
	onOpenChange,
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: RatingDialogProps) {
	const { data: ratingRecord } = useRating({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const setRatingMutation = useSetRating({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const clearRatingMutation = useClearRating({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const rating = ratingRecord?.rating ?? 0;
	const rated = rating > 0;

	const resolvedMediaType =
		episodeNumber != null
			? "episode"
			: seasonNumber != null
				? "season"
				: mediaType;

	const handleChange = (value: number) => {
		setRatingMutation.mutate({
			body: {
				mediaType: resolvedMediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
				rating: value,
			},
		});
	};

	const handleClear = () => {
		if (!ratingRecord?.id) return;
		clearRatingMutation.mutate(
			{ path: { ratingId: ratingRecord.id } },
			{ onSuccess: () => onOpenChange(false) },
		);
	};

	const isPending =
		setRatingMutation.isPending || clearRatingMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Star className="size-4 text-(--accent)" />
						Your Rating
					</DialogTitle>
					<DialogDescription className="sr-only">
						Rate this title from half a star to five stars.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col items-center gap-3 py-2">
					<StarRating value={rating} onChange={handleChange} size="lg" />
					{rated ? (
						<div className="flex items-baseline gap-1">
							<span className="font-bold font-display text-(--foreground) text-2xl">
								{ratingToStars(rating).toFixed(1)}
							</span>
							<span className="text-(--foreground-subtle) text-sm">/ 5</span>
						</div>
					) : (
						<span className="text-(--foreground-subtle) text-sm">
							Click a star to rate
						</span>
					)}
				</div>

				<div className="flex items-center justify-between">
					{rated ? (
						<button
							type="button"
							onClick={handleClear}
							disabled={isPending}
							className="btn btn-ghost btn-sm gap-1 text-(--foreground-muted)"
						>
							{clearRatingMutation.isPending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<StarOff className="size-3.5" />
							)}
							Clear rating
						</button>
					) : (
						<span />
					)}
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="btn btn-secondary btn-sm gap-1"
					>
						<X className="size-3.5" />
						Close
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
