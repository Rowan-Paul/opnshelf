import {
	authControllerMeOptions,
	moviesControllerGetUserMoviesOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { MovieGridSkeleton } from "@/components/MovieGrid";
import { ShelfMovieCard } from "@/components/ShelfMovieCard";
import { UnauthenticatedState } from "@/components/UnauthenticatedState";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/shelf")({
	head: () => ({
		meta: [{ title: "My Shelf | OpnShelf" }],
	}),
	component: ShelfPage,
});

function ShelfPage() {
	const { data: user, isLoading: isAuthLoading } = useQuery({
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

	if (isAuthLoading) {
		return (
			<div className="min-h-screen bg-gray-950 text-gray-50">
				<div className="container mx-auto px-4 py-4 max-w-7xl">
					<MovieGridSkeleton />
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<UnauthenticatedState
				title="My Shelf"
				description="Sign in to track movies you've watched"
			/>
		);
	}

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<div className="flex items-center gap-3 mb-8">
					<BookOpen className="w-8 h-8 text-purple-500" />
					<h1 className="text-4xl font-bold">My Shelf</h1>
				</div>

				{isMoviesLoading && <MovieGridSkeleton />}

				{trackedMovies && trackedMovies.length > 0 && (
					<div>
						<p className="text-gray-400 mb-6">
							{trackedMovies.length} movie
							{trackedMovies.length !== 1 ? "s" : ""} watched
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
							{trackedMovies.map((tracked) => (
								<ShelfMovieCard
									key={tracked.id}
									tracked={tracked}
									user={user}
								/>
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
		</div>
	);
}
