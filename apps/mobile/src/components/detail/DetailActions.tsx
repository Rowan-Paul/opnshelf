import {
	MediaTrackingActions,
	type TrackingTarget,
} from "@/components/detail/MediaTrackingActions";
import { MoreActionsButton } from "@/components/detail/MoreActionsButton";
import { RateReviewButton } from "@/components/detail/RateReviewButton";
import { WatchlistButton } from "@/components/detail/WatchlistButton";

/**
 * The action cluster for every media detail screen: one row of the shelf
 * button, Watchlist, Rate and More, with the rest of the actions in More's
 * sheet. Mirrors the hierarchy of web's `MediaActionsBar`.
 */
export function DetailActions({
	tracking,
	target,
	share,
}: {
	tracking: TrackingTarget;
	/** The item the Watchlist, rating, note, library and lists act on. */
	target: {
		mediaType: "movie" | "show";
		mediaId: string;
		seasonNumber?: number;
		episodeNumber?: number;
	};
	share?: { url: string; title: string };
}) {
	return (
		<MediaTrackingActions
			{...tracking}
			renderTrailing={(addWithDate) => (
				<>
					<WatchlistButton {...target} />
					<RateReviewButton {...target} />
					<MoreActionsButton
						target={target}
						share={share}
						addWithDate={addWithDate}
					/>
				</>
			)}
		/>
	);
}
