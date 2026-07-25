import { moviesControllerGetMovieDetailsOptions } from "@opnshelf/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMovieDetails } from "#/lib/hooks";
import { FullCredits } from "../../../../components/CreditsSections";

export const Route = createFileRoute("/movies/$movieId/$movieName/credits")({
	loader: async ({ context, params }) =>
		context.queryClient.ensureQueryData(
			moviesControllerGetMovieDetailsOptions({
				path: { movieId: params.movieId },
			}),
		),
	head: ({ loaderData }) => ({
		meta: [
			{ title: `Cast & crew — ${loaderData?.title ?? "Movie"} | Opnshelf` },
		],
	}),
	component: MovieCreditsPage,
});

function MovieCreditsPage() {
	const { movieId, movieName } = Route.useParams();
	const { data: movie } = useMovieDetails(movieId);

	return (
		<div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
			<Link
				to="/movies/$movieId/$movieName"
				params={{ movieId, movieName }}
				className="mb-6 inline-flex items-center gap-1 text-(--foreground-muted) text-sm hover:text-(--foreground)"
			>
				<ChevronLeft className="size-4" />
				{movie?.title ?? "Back to movie"}
			</Link>
			<h1 className="mb-8 text-display-2">Cast & crew</h1>
			<FullCredits mediaType="movie" mediaId={movieId} />
		</div>
	);
}
