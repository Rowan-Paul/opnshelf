import { StarRating } from "@/components/detail/StarRating";

export function ProfileReviewRating({
	authorRating,
}: {
	authorRating?: number | null;
}) {
	if (authorRating == null || authorRating <= 0) return null;

	return <StarRating rating={authorRating} size={14} />;
}
