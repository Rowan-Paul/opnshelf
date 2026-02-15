import {
	authControllerMeOptions,
	moviesControllerGetUserMoviesOptions,
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

			{trackedMovies && trackedMovies.length === 0 && (
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
							Start tracking movies you&apos;ve watched
						</M3CardDescription>
					</M3CardHeader>
					<M3CardContent>
						<M3Button variant="filled" asChild>
							<Link to="/search" search={{ q: "" }}>
								Search for movies
							</Link>
						</M3Button>
					</M3CardContent>
				</M3Card>
			)}
		</div>
	);
}
