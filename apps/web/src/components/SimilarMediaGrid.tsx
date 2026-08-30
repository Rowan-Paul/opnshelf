import { useAuth } from "#/lib/auth-context";
import { useBatchRatingsQuery } from "#/lib/hooks/useRatings";
import { ShowProgressScope } from "#/lib/hooks/useShowProgress";
import ActionableMediaCard from "./ActionableMediaCard";

interface SimilarItem {
	id: string | number;
	title: string;
	type: "movie" | "show";
	year?: number;
	posterUrl: string;
	tmdbRating?: number;
}

interface SimilarMediaGridProps {
	items: SimilarItem[];
	title?: string;
}

export default function SimilarMediaGrid({
	items,
	title = "Similar",
}: SimilarMediaGridProps) {
	const { isAuthenticated } = useAuth();
	const { ratings } = useBatchRatingsQuery(items);

	if (items.length === 0) return null;

	return (
		<section>
			<h2 className="mb-4 text-display-3">{title}</h2>
			<ShowProgressScope
				showIds={items
					.filter((item) => item.type === "show")
					.map((item) => item.id)}
			>
				<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
					{items.map((item) => (
						<div key={item.id} className="[&_article]:!w-full">
							<ActionableMediaCard
								id={item.id}
								title={item.title}
								posterUrl={item.posterUrl}
								type={item.type}
								globalRating={ratings.get(String(item.id))?.averageRating}
								tmdbRating={item.tmdbRating}
								size="sm"
								layout="poster"
								interactive={isAuthenticated}
							/>
						</div>
					))}
				</div>
			</ShowProgressScope>
		</section>
	);
}
