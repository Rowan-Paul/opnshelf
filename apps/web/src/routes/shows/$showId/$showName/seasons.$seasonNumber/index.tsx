import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { setupApiClient } from "#/lib/api";
import { useShowDetails } from "#/lib/hooks";
import { buildSeasonPageMeta } from "#/lib/media-meta";
import { buildShowUrl } from "#/lib/url-utils";

setupApiClient();

export const Route = createFileRoute(
	"/shows/$showId/$showName/seasons/$seasonNumber/",
)({
	loader: async ({ context, params }) => {
		const [show, season] = await Promise.all([
			context.queryClient.ensureQueryData(
				showsControllerGetShowDetailsOptions({
					path: { showId: params.showId },
				}),
			),
			context.queryClient.ensureQueryData(
				showsControllerGetSeasonDetailsOptions({
					path: {
						showId: params.showId,
						seasonNumber: params.seasonNumber,
					},
				}),
			),
		]);

		return { show, season };
	},
	head: ({ loaderData, params }) => {
		const meta = buildSeasonPageMeta(
			loaderData?.show,
			loaderData?.season,
			params.seasonNumber,
		);

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
	component: SeasonDetailPage,
});

function SeasonDetailPage() {
	const { showId, showName, seasonNumber } = Route.useParams();
	const { data: show, isLoading } = useShowDetails(showId);
	const seasonNum = Number.parseInt(seasonNumber, 10);
	const season = show?.seasons?.find((s) => s.season_number === seasonNum);

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
				<Link
					to={buildShowUrl(showId, show?.name || showName)}
					className="btn btn-secondary mb-6 inline-flex gap-2"
				>
					<ChevronLeft className="h-4 w-4" />
					Back to {show?.name || showName}
				</Link>

				<div className="card p-8 text-center">
					<h1 className="text-display-2 mb-4">Season Detail - Placeholder</h1>
					<p className="text-[var(--foreground-muted)] mb-4">
						This is a placeholder for the season detail page.
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
						{season && (
							<>
								<p>
									<strong>Season Name:</strong> {season.name}
								</p>
								<p>
									<strong>Episodes:</strong> {season.episode_count}
								</p>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
