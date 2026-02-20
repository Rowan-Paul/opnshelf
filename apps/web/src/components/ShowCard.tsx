import type { TmdbShowResultDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

interface ShowCardProps {
	show: TmdbShowResultDto;
}

export function ShowCard({ show }: ShowCardProps) {
	const compatShow = show as TmdbShowResultDto & {
		posterPath?: string | null;
		firstAirDate?: string | null;
	};
	const showId = show.id.toString();
	const posterUrl = getTmdbPosterUrl(
		show.poster_path ?? compatShow.posterPath ?? null,
	);
	const firstAirDate = show.first_air_date ?? compatShow.firstAirDate ?? null;
	const year = firstAirDate ? firstAirDate.split("-")[0] : undefined;

	return (
		<div className="group">
			<Link
				to="/shows/$showId/$title"
				params={{ showId, title: createTitleSlug(show.name) }}
				className="block relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2"
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={show.name}
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-gray-600">
						No poster
					</div>
				)}
			</Link>
			<Link
				to="/shows/$showId/$title"
				params={{ showId, title: createTitleSlug(show.name) }}
				className="block"
			>
				<h3 className="font-semibold text-sm line-clamp-2 mb-1 hover:text-amber-400 transition-colors">
					{show.name}
				</h3>
				{year && <p className="text-gray-500 text-sm">{year}</p>}
			</Link>
		</div>
	);
}
