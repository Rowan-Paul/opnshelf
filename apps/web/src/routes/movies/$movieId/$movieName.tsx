import { moviesControllerGetMovieDetailsOptions } from "@opnshelf/api";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock, Loader2, Plus, Star, X } from "lucide-react";
import { setupApiClient } from "#/lib/api";
import {
	useDiscoverMovies,
	useMediaWatchStatus,
	useMovieDetails,
	useWatchActions,
} from "#/lib/hooks";
import { buildMoviePageMeta } from "#/lib/media-meta";
import CastGrid from "../../../components/CastGrid";
import DetailsCard from "../../../components/DetailsCard";
import ErrorState from "../../../components/ErrorState";
import InYourLists from "../../../components/InYourLists";
import LoadingState from "../../../components/LoadingState";
import MediaActionsBar from "../../../components/MediaActionsBar";
import MediaHero from "../../../components/MediaHero";
import SimilarMediaGrid from "../../../components/SimilarMediaGrid";

setupApiClient();

export const Route = createFileRoute("/movies/$movieId/$movieName")({
	loader: async ({ context, params }) => {
		return context.queryClient.ensureQueryData(
			moviesControllerGetMovieDetailsOptions({
				path: { movieId: params.movieId },
			}),
		);
	},
	head: ({ loaderData, params }) => {
		const meta = buildMoviePageMeta(loaderData, params.movieName);

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
	component: MovieDetailPage,
});

function formatRuntime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours}h ${mins}m`;
}

function formatDate(dateString: string): string {
	if (!dateString) return "Unknown";
	try {
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return dateString;
	}
}

function MovieDetailPage() {
	const { movieId } = Route.useParams();

	const { data: movie, isLoading, error } = useMovieDetails(movieId);
	const { data: similarMoviesData } = useDiscoverMovies(1);
	const { isWatched, movieWatchHistory } = useMediaWatchStatus({
		mediaType: "movie",
		movieId,
	});
	const {
		markMovieWatched,
		unmarkMovieWatched,
		isMarkMoviePending,
		isUnmarkMoviePending,
	} = useWatchActions({ mediaType: "movie", movieId });

	if (isLoading) return <LoadingState />;
	if (error || !movie) {
		return (
			<ErrorState
				message="Failed to load movie"
				backTo="/"
				backLabel="Back to Dashboard"
			/>
		);
	}

	const backdropUrl = movie.backdrop_path
		? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
		: movie.poster_path
			? `https://image.tmdb.org/t/p/original${movie.poster_path}`
			: "";
	const posterUrl = movie.poster_path
		? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
		: "";

	const director =
		movie.credits?.crew?.find((person) => person.job === "Director")?.name ||
		"Unknown";

	const cast =
		movie.credits?.cast?.slice(0, 6).map((actor) => ({
			name: actor.name,
			character: actor.character || "",
			photo: actor.profile_path
				? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
				: `https://i.pravatar.cc/150?u=${actor.id}`,
		})) || [];

	const similarMovies =
		similarMoviesData?.results
			?.filter((m) => m.id !== Number(movieId))
			?.slice(0, 4)
			?.map((m) => ({
				id: String(m.id),
				title: m.title,
				type: "movie" as const,
				year: m.release_date
					? new Date(m.release_date).getFullYear()
					: undefined,
				posterUrl: m.poster_path
					? `https://image.tmdb.org/t/p/w300${m.poster_path}`
					: "",
				rating: (m as { vote_average?: number }).vote_average
					? Math.round((m as { vote_average?: number }).vote_average! * 10) / 10
					: undefined,
			})) || [];

	return (
		<div className="min-h-screen pb-8">
			<MediaHero
				title={movie.title}
				backdropUrl={backdropUrl}
				posterUrl={posterUrl}
				metaItems={
					<>
						<div className="flex items-center gap-1">
							<Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
							<span className="font-semibold">{movie.vote_average}</span>
							<span className="text-[var(--foreground-muted)]">/10</span>
						</div>
						<span className="text-[var(--border-strong)]">•</span>
						<span>{formatRuntime(movie.runtime || 0)}</span>
						<span className="text-[var(--border-strong)]">•</span>
						<span>
							{movie.release_date
								? new Date(movie.release_date).toLocaleDateString("en-US", {
										month: "long",
										day: "numeric",
										year: "numeric",
									})
								: "Unknown"}
						</span>
						<span className="text-[var(--border-strong)]">•</span>
						<div className="flex gap-2">
							{movie.genres?.map((g) => (
								<span key={g.name} className="badge badge-subtle">
									{g.name}
								</span>
							))}
						</div>
					</>
				}
				actions={
					<>
						{isWatched ? (
							<button
								type="button"
								onClick={unmarkMovieWatched}
								disabled={isUnmarkMoviePending}
								className="btn gap-2 bg-green-500/10 text-green-600 border-green-500/20 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/20"
							>
								{isUnmarkMoviePending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading
									</>
								) : (
									<>
										<X className="h-4 w-4" />
										Remove from shelf
									</>
								)}
							</button>
						) : (
							<button
								type="button"
								onClick={markMovieWatched}
								disabled={isMarkMoviePending}
								className="btn btn-primary gap-2"
							>
								{isMarkMoviePending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading
									</>
								) : (
									<>
										<Plus className="h-4 w-4" />
										Add to shelf
									</>
								)}
							</button>
						)}
						<MediaActionsBar mediaType="movie" mediaId={movieId} />
					</>
				}
			/>

			{/* Main Content */}
			<div className="container-app relative z-20 mt-8">
				<div className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:gap-12">
					{/* Left Column */}
					<div className="space-y-8">
						<section>
							<h2 className="text-display-3 mb-4">Overview</h2>
							<p className="text-[var(--foreground-muted)] leading-relaxed">
								{movie.overview}
							</p>
						</section>

						<CastGrid cast={cast} />
						<SimilarMediaGrid items={similarMovies} title="Similar Movies" />
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6">
						<DetailsCard
							items={[
								{ label: "Director", value: director },
								{
									label: "Runtime",
									value: formatRuntime(movie.runtime || 0),
								},
								{
									label: "Release",
									value: movie.release_date
										? new Date(movie.release_date).toLocaleDateString("en-US", {
												month: "long",
												day: "numeric",
												year: "numeric",
											})
										: "Unknown",
								},
								{
									label: "Genres",
									value: movie.genres?.map((g) => g.name).join(", ") || "N/A",
								},
							]}
						/>

						{/* Your Activity */}
						<section className="card p-5">
							<h3 className="font-display font-semibold mb-4">Your Activity</h3>
							{movieWatchHistory &&
							Array.isArray(movieWatchHistory) &&
							movieWatchHistory.length > 0 ? (
								<div className="space-y-3">
									{movieWatchHistory.map((entry, index) => (
										<div
											key={entry.id || index}
											className="flex items-center gap-2 text-green-600"
										>
											<Check className="h-5 w-5" />
											<span className="font-medium">
												Watched on {formatDate(entry.watchedDate)}
											</span>
										</div>
									))}
								</div>
							) : (
								<div className="empty-state p-0">
									<Clock className="h-10 w-10 text-[var(--foreground-subtle)]" />
									<p className="mt-2 text-sm text-[var(--foreground-muted)]">
										You haven&apos;t watched this yet
									</p>
								</div>
							)}
						</section>

						<InYourLists mediaType="movie" mediaId={movieId} />
					</div>
				</div>
			</div>
		</div>
	);
}
