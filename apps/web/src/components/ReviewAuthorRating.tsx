import StarRating from "./StarRating";

export function ReviewAuthorRating({ rating }: { rating?: number | null }) {
	if (rating == null || rating <= 0) return null;

	return <StarRating value={rating} readOnly size="sm" />;
}
