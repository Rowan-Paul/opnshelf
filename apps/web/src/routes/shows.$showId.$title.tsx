import {
	authControllerMeOptions,
	showsControllerGetShowDetailsOptions,
	type TmdbShowDetailDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
	useRouter,
} from "@tanstack/react-router";
import { ArrowLeft, Calendar, Tv } from "lucide-react";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
import { GenresSection } from "@/components/GenresSection";
import { formatDateOnly, getTmdbBackdropUrl, getTmdbPosterUrl } from "@/lib/utils";

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
	const matches = useMatches();
	const isLeafRoute = matches[matches.length - 1]?.routeId === Route.id;
	const router = useRouter();

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const { data: showData, isLoading } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId },
		}),
	});

	const show = showData as TmdbShowDetailDto | undefined;
	const backdropUrl = getTmdbBackdropUrl(show?.backdrop_path);
	const posterUrl = getTmdbPosterUrl(show?.poster_path, "w500");
	const seasonCount = show?.number_of_seasons || 0;
	const episodeCount = show?.number_of_episodes || 0;
	const colors = show?.colors || {
		primary: "#8b5cf6",
		secondary: "#6366f1",
		accent: "#a855f7",
		muted: "#6b7280",
	};

	return (
		<div>
			{isLeafRoute && (
				<>
					<div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
						{backdropUrl ? (
							<>
								<img src={backdropUrl} alt="" className="w-full h-full object-cover" />
								<div
									className="absolute inset-0"
									style={{
										background:
											"linear-gradient(to bottom, transparent 0%, rgba(3, 7, 18, 0.6) 60%, rgb(3, 7, 18) 100%)",
									}}
								/>
								<div
									className="absolute inset-0"
									style={{
										background:
											"linear-gradient(to right, rgba(3, 7, 18, 0.8) 0%, transparent 50%)",
									}}
								/>
							</>
						) : (
							<div
								className="w-full h-full"
								style={{
									background: `linear-gradient(135deg, ${colors.muted} 0%, rgb(3, 7, 18) 100%)`,
								}}
							/>
						)}

						<button
							type="button"
							onClick={() => router.history.back()}
							className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors cursor-pointer"
						>
							<ArrowLeft className="w-5 h-5" />
						</button>

						<div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
							<div className="container mx-auto max-w-6xl">
								<div className="flex items-end gap-4 md:gap-8">
									<div className="shrink-0">
										<div
											className="w-28 md:w-48 lg:w-64 rounded-lg overflow-hidden shadow-2xl"
											style={{ boxShadow: `0 25px 50px -12px ${colors.primary}40` }}
										>
											{posterUrl ? (
												<img
													src={posterUrl}
													alt={show?.name || title}
													className="w-full aspect-2/3 object-cover"
												/>
											) : (
												<div className="w-full aspect-2/3 bg-gray-900 flex items-center justify-center">
													<span className="text-gray-600">No poster</span>
												</div>
											)}
										</div>
									</div>

									<div className="flex-1 pb-2">
										<h1
											className="text-2xl md:text-5xl lg:text-6xl font-bold mb-2"
											style={{ textShadow: `0 4px 30px ${colors.primary}60` }}
										>
											{isLoading ? "Loading..." : (show?.name ?? title.replace(/-/g, " "))}
										</h1>
										<div className="flex flex-wrap items-center gap-4 text-sm md:text-base text-gray-300">
											{show?.first_air_date && (
												<span className="flex items-center gap-2">
													<Calendar className="w-4 h-4" style={{ color: colors.accent }} />
													{new Date(show.first_air_date).getFullYear()}
												</span>
											)}
											<span className="flex items-center gap-2">
												<Tv className="w-4 h-4" style={{ color: colors.accent }} />
												{episodeCount} episodes
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="container mx-auto px-4 py-6 max-w-6xl">
						<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
							<div className="space-y-4">
								<div className="p-4 rounded-lg bg-gray-900/50">
									<span className="text-gray-500 text-sm block mb-1">First Air Date</span>
									<span className="font-medium" style={{ color: colors.accent }}>
										{show?.first_air_date ? formatDateOnly(show.first_air_date) : "Unknown"}
									</span>
								</div>
								<div className="p-4 rounded-lg bg-gray-900/50">
									<span className="text-gray-500 text-sm block mb-1">Seasons</span>
									<span className="font-medium" style={{ color: colors.accent }}>
										{seasonCount}
									</span>
								</div>
								<div className="p-4 rounded-lg bg-gray-900/50">
									<span className="text-gray-500 text-sm block mb-1">Episodes</span>
									<span className="font-medium" style={{ color: colors.accent }}>
										{episodeCount}
									</span>
								</div>
							</div>

							<div className="space-y-6 min-w-0">
								<section>
									<h2 className="text-xl font-semibold mb-3" style={{ color: colors.primary }}>
										Overview
									</h2>
									<p className="text-gray-300 leading-relaxed">
										{show?.overview || "No overview available."}
									</p>
								</section>

								<GenresSection genres={show?.genres} colors={colors} />

								<section className="pt-2">
									<h2 className="text-xl font-semibold mb-4" style={{ color: colors.primary }}>
										Seasons
									</h2>
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
													className="rounded-xl p-4 border hover:bg-gray-900/40 transition-colors"
													style={{ borderColor: "var(--md-sys-color-outline)" }}
												>
													<div className="font-medium">Season {seasonNumber}</div>
													{user && (
														<div className="text-xs mt-1 text-gray-400">Open details</div>
													)}
												</Link>
											);
										})}
									</div>
								</section>

								<CastSection cast={show?.credits?.cast} colors={colors} />
								<CrewSection crew={show?.credits?.crew} colors={colors} />
							</div>
						</div>
					</div>
				</>
			)}
			<Outlet />
		</div>
	);
}
