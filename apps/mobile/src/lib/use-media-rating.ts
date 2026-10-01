import {
	type RatingsControllerGetMediaRatingData,
	ratingsControllerGetMediaRatingOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

/** The public Opnshelf average, scoped to this movie, show, season or episode. */
export function useMediaRating(
	query: RatingsControllerGetMediaRatingData["query"],
) {
	return useQuery({
		...ratingsControllerGetMediaRatingOptions({ query }),
		enabled: !!query.mediaId,
	});
}
