import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	type TmdbSeasonDetailDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/shows/$showId/$title/seasons/$seasonNumber",
)({
	component: ShowSeasonPage,
});

function ShowSeasonPage() {
	const { showId, title, seasonNumber } = Route.useParams();
	const { data: seasonData } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId, seasonNumber },
		}),
	});
	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId },
		}),
	});

	const season = seasonData as TmdbSeasonDetailDto | undefined;

	return (
		<div className="container mx-auto px-4 py-6 max-w-6xl">
			<h1 className="md-display-small mb-2">{showData?.name}</h1>
			<h2 className="md-title-large mb-6">Season {seasonNumber}</h2>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{(season?.episodes || []).map((episode) => (
					<Link
						key={episode.id}
						to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
						params={{
							showId,
							title,
							seasonNumber,
							episodeNumber: String(episode.episode_number),
						}}
						className="rounded-xl p-4 border"
						style={{ borderColor: "var(--md-sys-color-outline)" }}
					>
						<div className="font-medium">Episode {episode.episode_number}</div>
						<div className="text-sm mt-1">{episode.name}</div>
					</Link>
				))}
			</div>
		</div>
	);
}
