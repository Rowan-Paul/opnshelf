import {
	authControllerMeOptions,
	moviesControllerGetUserMoviesOptions,
	showsControllerGetUserShowsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { MovieGridSkeleton } from "@/components/MovieGrid";
import { ShelfMovieCard } from "@/components/ShelfMovieCard";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

export const Route = createFileRoute("/profile/shelf")({
	head: () => ({
		meta: [{ title: "My Shelf | OpnShelf" }],
	}),
	component: ShelfPage,
});

function ShelfPage() {
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: trackedMovies, isLoading: isMoviesLoading } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});
	const { data: trackedShows } = useQuery({
		...showsControllerGetUserShowsOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	if (isMoviesLoading) {
		return <MovieGridSkeleton />;
	}

	return (
		<div>
			{trackedMovies && trackedMovies.length > 0 && (
				<div>
					<p
						className="mb-6 md-body-large"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{trackedMovies.length} movie
						{trackedMovies.length !== 1 ? "s" : ""} watched
					</p>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
						{trackedMovies.map((tracked) => (
							<ShelfMovieCard key={tracked.id} tracked={tracked} user={user} />
						))}
					</div>
				</div>
			)}

			{trackedShows && trackedShows.length > 0 && (
				<div className="mt-10">
					<p
						className="mb-4 md-body-large"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{trackedShows.length} show
						{trackedShows.length !== 1 ? "s" : ""} tracked
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
						{trackedShows.map((tracked) => (
							<Link
								key={tracked.showId}
								to="/shows/$showId/$title"
								params={{
									showId: tracked.showId,
									title: tracked.show.title
										.toLowerCase()
										.replace(/[^a-z0-9]+/g, "-"),
								}}
								className="rounded-xl border p-4"
								style={{ borderColor: "var(--md-sys-color-outline)" }}
							>
								<div className="font-semibold">{tracked.show.title}</div>
								<div
									className="text-sm mt-1"
									style={{ color: "var(--md-sys-color-on-surface-variant)" }}
								>
									{tracked.watchCount} watched episode
									{tracked.watchCount === 1 ? "" : "s"}
								</div>
							</Link>
						))}
					</div>
				</div>
			)}

			{trackedMovies &&
				trackedMovies.length === 0 &&
				(!trackedShows || trackedShows.length === 0) && (
					<M3Card variant="elevated" className="text-center max-w-md mx-auto">
						<M3CardHeader>
							<BookOpen
								className="w-16 h-16 mx-auto mb-4"
								style={{ color: "var(--md-sys-color-outline)" }}
							/>
							<M3CardTitle className="md-headline-small">
								Your shelf is empty
							</M3CardTitle>
							<M3CardDescription>
								Start tracking movies and shows you&apos;ve watched
							</M3CardDescription>
						</M3CardHeader>
						<M3CardContent>
							<M3Button variant="filled" asChild>
								<Link to="/search" search={{ q: "", type: "all" }}>
									Search for movies or shows
								</Link>
							</M3Button>
						</M3CardContent>
					</M3Card>
				)}
		</div>
	);
}
