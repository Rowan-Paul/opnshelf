import {
	authControllerMeOptions,
	showsControllerGetShowDetailsOptions,
	type TmdbShowDetailDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Layers } from "lucide-react";

export const Route = createFileRoute("/shows/$showId/$title")({
	component: ShowDetailPage,
	head: ({ params }) => ({
		meta: [
			{
				title: `${params.title.replace(/-/g, " ")} | OpnShelf`,
			},
		],
	}),
});

function ShowDetailPage() {
	const { showId, title } = Route.useParams();
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const { data } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId },
		}),
	});

	const show = data as TmdbShowDetailDto | undefined;
	const seasonCount = show?.number_of_seasons || 0;

	return (
		<div className="container mx-auto px-4 py-6 max-w-6xl">
			<h1 className="md-display-small mb-2">{show?.name}</h1>
			<p
				className="mb-6"
				style={{ color: "var(--md-sys-color-on-surface-variant)" }}
			>
				{show?.overview || "No overview available."}
			</p>
			<div className="flex flex-wrap gap-4 mb-8">
				{show?.first_air_date && (
					<div className="flex items-center gap-2 text-sm">
						<Calendar className="w-4 h-4" />
						<span>{new Date(show.first_air_date).toLocaleDateString()}</span>
					</div>
				)}
				<div className="flex items-center gap-2 text-sm">
					<Layers className="w-4 h-4" />
					<span>{seasonCount} seasons</span>
				</div>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
				{Array.from({ length: seasonCount }).map((_, idx) => {
					const seasonNumber = idx + 1;
					return (
						<Link
							key={seasonNumber}
							to="/shows/$showId/$title/seasons/$seasonNumber"
							params={{
								showId,
								title,
								seasonNumber: String(seasonNumber),
							}}
							className="rounded-xl p-4 border"
							style={{ borderColor: "var(--md-sys-color-outline)" }}
						>
							<div className="font-medium">Season {seasonNumber}</div>
							{user && (
								<div
									className="text-xs mt-1"
									style={{ color: "var(--md-sys-color-on-surface-variant)" }}
								>
									Open details
								</div>
							)}
						</Link>
					);
				})}
			</div>
		</div>
	);
}
