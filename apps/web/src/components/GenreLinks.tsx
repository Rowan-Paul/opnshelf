import { genreDiscoverySearch } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";

export function GenreLinks({
	genres,
	mediaType,
	compact = false,
}: {
	genres?: { id: number; name: string }[];
	mediaType: "movie" | "show";
	compact?: boolean;
}) {
	return (
		<span
			className={`inline-flex flex-wrap gap-2 ${compact ? "justify-end" : ""}`}
		>
			{genres?.map((genre) => (
				<Link
					key={genre.id}
					to="/search"
					search={genreDiscoverySearch(mediaType, genre)}
					className={
						compact
							? "text-(--accent) hover:underline"
							: "badge badge-subtle hover:text-(--accent)"
					}
				>
					{genre.name}
				</Link>
			))}
		</span>
	);
}
