import {
	authControllerMeOptions,
	moviesControllerGetUserMoviesOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { MovieGridSkeleton } from "@/components/MovieGrid";
import { ShelfMovieCard } from "@/components/ShelfMovieCard";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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
					<p className="text-gray-400 mb-6">
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
				<Card className="bg-gray-900 border-gray-800 text-center max-w-md mx-auto">
					<CardHeader>
						<BookOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
						<CardTitle className="text-2xl">Your shelf is empty</CardTitle>
						<CardDescription>
							Start tracking movies you&apos;ve watched
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link to="/search" search={{ q: "" }}>
								Search for movies
							</Link>
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
