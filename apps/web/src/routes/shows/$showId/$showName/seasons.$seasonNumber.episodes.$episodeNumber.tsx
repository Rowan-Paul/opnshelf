import {
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { setupApiClient } from "#/lib/api";
import { useShowDetails } from "#/lib/hooks";
import { buildEpisodePageMeta } from "#/lib/media-meta";
import { buildShowUrl } from "#/lib/url-utils";

setupApiClient();

export const Route = createFileRoute(
	"/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber",
)({
	loader: async ({ context, params }) => {
		const [show, episode] = await Promise.all([
			context.queryClient.ensureQueryData(
				showsControllerGetShowDetailsOptions({
					path: { showId: params.showId },
				}),
			),
			context.queryClient.ensureQueryData(
				showsControllerGetEpisodeDetailsOptions({
					path: {
						showId: params.showId,
						seasonNumber: params.seasonNumber,
						episodeNumber: params.episodeNumber,
					},
				}),
			),
		]);

		return { show, episode };
	},
	head: ({ loaderData, params }) => {
		const meta = buildEpisodePageMeta(loaderData?.show, loaderData?.episode, {
			seasonNumber: params.seasonNumber,
			episodeNumber: params.episodeNumber,
		});

		return {
			meta: [
				{ title: meta.title },
				{
					name: "description",
					content: meta.description,
				},
			],
		};
	},
	component: EpisodeDetailPage,
});

function EpisodeDetailPage() {
	const { showId, showName, seasonNumber, episodeNumber } = Route.useParams();

	// Fetch show details for context
	const { data: show, isLoading } = useShowDetails(showId);

	const seasonNum = Number.parseInt(seasonNumber, 10);
	const episodeNum = Number.parseInt(episodeNumber, 10);

	// Find the episode in show data
	const episode = show?.seasons
		?.find((s) => s.season_number === seasonNum)
		// @ts-expect-error - episodes may exist on TMDB result
		?.episodes?.find(
			(e: { episode_number: number }) => e.episode_number === episodeNum,
		);

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-12 w-12 animate-spin text-[var(--accent)]" />
			</div>
		);
	}

	return (
		<div className="min-h-screen pb-8">
			<div className="container-app py-8">
				{/* Back Button */}
				<Link
					to={buildShowUrl(showId, show?.name || showName)}
					className="btn btn-secondary mb-6 inline-flex gap-2"
				>
					<ChevronLeft className="h-4 w-4" />
					Back to {show?.name || showName}
				</Link>

				{/* Placeholder Content */}
				<div className="card p-8 text-center">
					<h1 className="text-display-2 mb-4">Episode Detail - Placeholder</h1>
					<p className="text-[var(--foreground-muted)] mb-4">
						This is a placeholder for the episode detail page.
					</p>
					<div className="space-y-2 text-sm text-[var(--foreground-muted)]">
						<p>
							<strong>Show ID:</strong> {showId}
						</p>
						<p>
							<strong>Show Name:</strong> {show?.name || showName}
						</p>
						<p>
							<strong>Season:</strong> {seasonNum}
						</p>
						<p>
							<strong>Episode:</strong> {episodeNum}
						</p>
						{episode && (
							<>
								<p>
									<strong>Episode Name:</strong> {episode.name}
								</p>
								<p>
									<strong>Air Date:</strong> {episode.air_date || "Unknown"}
								</p>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
