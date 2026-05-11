import { useBatchRatingsQuery } from "#/lib/hooks/useReviews";
import MediaCard from "./MediaCard";

interface SimilarItem {
	id: string | number;
	title: string;
	type: "movie" | "show";
	year?: number;
	posterUrl: string;
}

interface SimilarMediaGridProps {
	items: SimilarItem[];
	title?: string;
}

export default function SimilarMediaGrid({
	items,
	title = "Similar",
}: SimilarMediaGridProps) {
	// Always call hooks before any conditional return
	const { ratings } = useBatchRatingsQuery(items);

	if (items.length === 0) return null;

	return (
		<section>
			<h2 className="mb-4 text-display-3">{title}</h2>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{items.map((item) => (
					<MediaCard
						key={item.id}
						id={item.id}
						title={item.title}
						posterUrl={item.posterUrl}
						type={item.type}
						globalRating={ratings.get(String(item.id))?.averageRating}
						size="sm"
						layout="poster"
					/>
				))}
			</div>
		</section>
	);
}
