import { moviesControllerGetMovieDetailsOptions } from "@opnshelf/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Plus, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { env } from "#/env";
import { useAuth } from "#/lib/auth-context";
import { withUserLocale } from "#/lib/date-utils";
import {
	useMediaWatchStatus,
	useMovieDetails,
	useMovieRecommendations,
	useMovieWatchProviders,
	useWatchActions,
} from "#/lib/hooks";
import { useMediaRating } from "#/lib/hooks/useRatings";
import {
	buildMoviePageMeta,
	getOpenGraphMetaDescriptors,
} from "#/lib/media-meta";
import CommunityReviews from "../../../../components/CommunityReviews";
import { CreditsSummary } from "../../../../components/CreditsSections";
import DetailsCard from "../../../../components/DetailsCard";
import ErrorState from "../../../../components/ErrorState";
import { FriendWatchers } from "../../../../components/FriendWatchers";
import MediaActionsBar from "../../../../components/MediaActionsBar";
import MediaHero from "../../../../components/MediaHero";
import { ReviewDialog } from "../../../../components/ReviewDialog";
import SimilarMediaGrid from "../../../../components/SimilarMediaGrid";
import { DetailPageSkeleton } from "../../../../components/skeletons";
import WatchProviders from "../../../../components/WatchProviders";
import { YourActivity } from "../../../../components/YourActivity";
export const Route = createFileRoute("/movies/$movieId/$movieName/")({
	loader: async ({ context, params }) => {
		return context.queryClient.ensureQueryData(
			moviesControllerGetMovieDetailsOptions({
				path: { movieId: params.movieId },
			}),
		);
	},
	head: ({ loaderData, params, match }) => {
		const meta = buildMoviePageMeta(loaderData, params.movieName);
		const pageUrl = env.VITE_SITE_URL
			? `${env.VITE_SITE_URL}${match.pathname}`
			: undefined;

		return {
			meta: [
				{ title: meta.title },
				{
					name: "description",
					content: meta.description,
				},
				...getOpenGraphMetaDescriptors(meta, pageUrl),
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

function MovieDetailPage() {
	const { movieId, movieName } = Route.useParams();
	const {
		user,
		userSettings,
		isAuthenticated,
		isLoading: authLoading,
	} = useAuth();
	const navigate = useNavigate();
	const userTimezone = userSettings?.timezone;

	// Redirect authenticated users who still need onboarding
	useEffect(() => {
		if (!authLoading && isAuthenticated && user?.needsOnboarding) {
			navigate({ to: "/onboarding" });
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	const { data: movie, isLoading, error } = useMovieDetails(movieId);
	const { data: similarMoviesData } = useMovieRecommendations(movieId);
	const { isWatched, movieWatchHistory } = useMediaWatchStatus({
		mediaType: "movie",
		movieId,
	});
	const {
		markMovieWatched,
		unmarkMovieWatched,
		deleteMovieWatchHistoryEntry,
		isMarkMoviePending,
		isUnmarkMoviePending,
		isDeleteMovieHistoryPending,
	} = useWatchActions({ mediaType: "movie", movieId });

	const { data: mediaRating } = useMediaRating({
		mediaType: "movie",
		mediaId: movieId,
	});

	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
	const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
	const [watchProvidersCountry, setWatchProvidersCountry] = useState("US");
	const hasSyncedCountry = useRef(false);
	useEffect(() => {
		if (!hasSyncedCountry.current && userSettings?.watchCountry) {
			hasSyncedCountry.current = true;
			setWatchProvidersCountry(userSettings.watchCountry);
		}
	}, [userSettings]);

	const { data: watchProvidersData } = useMovieWatchProviders(
		movieId,
		watchProvidersCountry,
	);

	if (isLoading) return <DetailPageSkeleton />;
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

	const similarMovies =
		similarMoviesData?.results
			?.filter((m) => m.id !== Number(movieId))
			?.slice(0, 6)
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
				tmdbRating: m.vote_average || undefined,
			})) || [];

	return (
		<div className="min-h-screen pb-8">
			<MediaHero
				title={movie.title}
				backdropUrl={backdropUrl}
				posterUrl={posterUrl}
				backLabel={isAuthenticated ? "Back to Dashboard" : "Back to Home"}
				metaItems={
					<>
						<div className="flex items-center gap-1">
							<Star className="size-4 fill-yellow-500 text-yellow-500" />
							<span className="font-semibold">
								{(
									mediaRating?.averageRating ?? Number(movie.vote_average)
								).toFixed(1)}
							</span>
							<span className="text-(--foreground-muted)">/10</span>
						</div>
						<span className="text-(--border-strong)">•</span>
						<span>{formatRuntime(movie.runtime || 0)}</span>
						<span className="text-(--border-strong)">•</span>
						<span>
							{movie.release_date
								? new Date(movie.release_date).toLocaleDateString(
										"en-US",
										withUserLocale(
											{ month: "long", day: "numeric", year: "numeric" },
											userTimezone,
										),
									)
								: "Unknown"}
						</span>
						<span className="text-(--border-strong)">•</span>
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
					isAuthenticated ? (
						<>
							{isWatched ? (
								<button
									type="button"
									onClick={() => {
										if (movieWatchHistory && movieWatchHistory.length > 1) {
											setConfirmRemoveOpen(true);
										} else {
											unmarkMovieWatched();
										}
									}}
									disabled={isUnmarkMoviePending}
									className="btn gap-2 border-green-500/20 bg-green-500/10 text-green-600 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600"
								>
									{isUnmarkMoviePending ? (
										<>
											<Loader2 className="size-4 animate-spin" />
											Loading
										</>
									) : (
										<>
											<X className="size-4" />
											Remove from shelf
										</>
									)}
								</button>
							) : (
								<button
									type="button"
									onClick={() => markMovieWatched()}
									disabled={isMarkMoviePending}
									className="btn btn-primary gap-2"
								>
									{isMarkMoviePending ? (
										<>
											<Loader2 className="size-4 animate-spin" />
											Loading
										</>
									) : (
										<>
											<Plus className="size-4" />
											Add to shelf
										</>
									)}
								</button>
							)}
							<MediaActionsBar mediaType="movie" mediaId={movieId} />
						</>
					) : (
						<Link to="/login" className="btn btn-primary gap-2">
							Sign in to add to shelf
						</Link>
					)
				}
			/>

			{/* Main Content */}
			<div className="container-app relative z-20 mt-8">
				<div className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:gap-x-12 lg:gap-y-8">
					{/* Left Column */}
					<div className="space-y-8">
						<section>
							<h2 className="mb-4 text-display-3">Overview</h2>
							<p className="text-(--foreground-muted) leading-relaxed">
								{movie.overview}
							</p>
						</section>

						<div className="hidden lg:block">
							<CreditsSummary
								credits={movie.credits}
								creditsTo="/movies/$movieId/$movieName/credits"
								creditsParams={{ movieId, movieName }}
							/>
						</div>
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6 lg:row-span-2">
						<FriendWatchers mediaType="movie" mediaId={movieId} />

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
										? new Date(movie.release_date).toLocaleDateString(
												"en-US",
												withUserLocale(
													{ month: "long", day: "numeric", year: "numeric" },
													userTimezone,
												),
											)
										: "Unknown",
								},
								{
									label: "Genres",
									value: movie.genres?.map((g) => g.name).join(", ") || "N/A",
								},
							]}
						/>

						<WatchProviders
							providers={watchProvidersData?.providers}
							availableCountries={watchProvidersData?.availableCountries}
							country={watchProvidersCountry}
							onCountryChange={setWatchProvidersCountry}
						/>

						{/* Your Activity */}
						{isAuthenticated && (
							<YourActivity
								watchHistory={movieWatchHistory || []}
								onAddToShelf={(watchedAt) => markMovieWatched(watchedAt)}
								onDeleteEntry={deleteMovieWatchHistoryEntry}
								isAddPending={isMarkMoviePending}
								isDeletePending={isDeleteMovieHistoryPending}
							/>
						)}
					</div>

					{/* Similar Movies — last on mobile, below left column on desktop */}
					<div className="order-last space-y-8 lg:order-none lg:col-start-1 lg:row-start-2">
						<div className="lg:hidden">
							<CreditsSummary
								credits={movie.credits}
								creditsTo="/movies/$movieId/$movieName/credits"
								creditsParams={{ movieId, movieName }}
							/>
						</div>
						<CommunityReviews
							mediaType="movie"
							mediaId={movieId}
							onAddReview={() => setReviewDialogOpen(true)}
						/>
						<SimilarMediaGrid items={similarMovies} title="Similar Movies" />
					</div>
				</div>
			</div>

			<ReviewDialog
				open={reviewDialogOpen}
				onOpenChange={setReviewDialogOpen}
				mediaType="movie"
				mediaId={movieId}
			/>

			{/* Confirm remove all plays dialog */}
			<Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="size-5 text-amber-500" />
							Remove all plays?
						</DialogTitle>
						<DialogDescription>
							This will remove all{" "}
							<strong>{movieWatchHistory?.length || 0}</strong> watch entries
							for <strong>{movie.title}</strong>. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<button
							type="button"
							onClick={() => setConfirmRemoveOpen(false)}
							className="btn btn-secondary"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => {
								unmarkMovieWatched();
								setConfirmRemoveOpen(false);
							}}
							disabled={isUnmarkMoviePending}
							className="btn bg-red-600 text-white hover:bg-red-700"
						>
							{isUnmarkMoviePending ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Removing...
								</>
							) : (
								"Remove all"
							)}
						</button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
