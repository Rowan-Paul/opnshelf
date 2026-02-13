import {
	authControllerMeOptions,
	listsControllerGetListOptions,
	listsControllerGetListQueryKey,
	listsControllerRemoveFromListMutation,
	type MovieInListDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, List, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { MovieGridSkeleton } from "@/components/MovieGrid";
import { UnauthenticatedState } from "@/components/UnauthenticatedState";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getTmdbPosterUrl } from "@/lib/utils";

export const Route = createFileRoute("/lists/$slug")({
	head: ({ params }) => ({
		meta: [{ title: `${params.slug} | OpnShelf` }],
	}),
	component: ListDetailPage,
});

function ListDetailPage() {
	const { slug } = Route.useParams();
	const queryClient = useQueryClient();

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: list, isLoading: isListLoading } = useQuery({
		...listsControllerGetListOptions({
			path: { slug },
		}),
		enabled: !!user?.did,
	});

	const removeMutation = useMutation({
		...listsControllerRemoveFromListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
			toast.success("Removed from list");
		},
		onError: () => {
			toast.error("Failed to remove. Please try again.");
		},
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
				title="List"
				description="Sign in to view your lists"
			/>
		);
	}

	if (isListLoading) {
		return (
			<div className="min-h-screen bg-gray-950 text-gray-50">
				<div className="container mx-auto px-4 py-4 max-w-7xl">
					<MovieGridSkeleton />
				</div>
			</div>
		);
	}

	if (!list) {
		return (
			<div className="min-h-screen bg-gray-950 text-gray-50">
				<div className="container mx-auto px-4 py-4 max-w-7xl">
					<Card className="bg-gray-900 border-gray-800 text-center max-w-md mx-auto">
						<CardHeader>
							<List className="w-16 h-16 text-gray-700 mx-auto mb-4" />
							<CardTitle className="text-2xl">List not found</CardTitle>
							<CardDescription>
								This list doesn&apos;t exist or you don&apos;t have access to it
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild>
								<Link to="/profile/lists">Back to lists</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const movies = list.items || [];

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<div className="mb-6">
					<Button variant="ghost" size="sm" asChild className="mb-4">
						<Link to="/profile/lists">
							<ArrowLeft className="w-4 h-4 mr-2" />
							Back to lists
						</Link>
					</Button>
					<div className="flex items-start justify-between">
						<div>
							<div className="flex items-center gap-3 mb-2">
								<List className="w-6 h-6 text-purple-500" />
								<h1 className="text-3xl font-bold">{list.name}</h1>
								{list.isDefault && (
									<span className="px-2 py-0.5 text-xs bg-purple-600 text-white rounded-full">
										Default
									</span>
								)}
							</div>
							{list.description && (
								<p className="text-gray-400">{list.description}</p>
							)}
						</div>
						{!list.isDefault && (
							<Button variant="destructive" size="sm">
								<Trash2 className="w-4 h-4 mr-2" />
								Delete
							</Button>
						)}
					</div>
				</div>

				{movies.length > 0 && (
					<>
						<p className="text-gray-400 mb-6">
							{movies.length} movie{movies.length !== 1 ? "s" : ""}
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
							{movies.map((item) => (
								<ListMovieCard
									key={item.id}
									item={item}
									slug={slug}
									onRemove={(movieId) => {
										removeMutation.mutate({
											path: { slug, movieId },
										});
									}}
									isRemoving={
										removeMutation.isPending &&
										removeMutation.variables?.path?.movieId === item.movieId
									}
								/>
							))}
						</div>
					</>
				)}

				{movies.length === 0 && (
					<Card className="bg-gray-900 border-gray-800 text-center max-w-md mx-auto">
						<CardHeader>
							<List className="w-16 h-16 text-gray-700 mx-auto mb-4" />
							<CardTitle className="text-2xl">No movies yet</CardTitle>
							<CardDescription>
								Add movies to this list from the search page
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

interface ListMovieCardProps {
	item: MovieInListDto;
	slug: string;
	onRemove: (movieId: string) => void;
	isRemoving: boolean;
}

function ListMovieCard({ item, onRemove, isRemoving }: ListMovieCardProps) {
	const movie = item.movie;
	const posterUrl = getTmdbPosterUrl(
		movie.posterPath as string | null | undefined,
	);
	const movieTitle = movie.title as string;
	const releaseYear = movie.releaseYear as number | null | undefined;

	return (
		<div className="group">
			<Link
				to="/movies/$movieId/$title"
				params={{
					movieId: item.movieId,
					title: movieTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
				}}
				className="block relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2"
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={movieTitle}
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-gray-600">
						No poster
					</div>
				)}
				<Button
					type="button"
					size="icon"
					variant="destructive"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onRemove(item.movieId);
					}}
					disabled={isRemoving}
					className="absolute top-2 right-2 z-10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"
				>
					{isRemoving ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<X className="w-4 h-4" />
					)}
				</Button>
			</Link>
			<Link
				to="/movies/$movieId/$title"
				params={{
					movieId: item.movieId,
					title: movieTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
				}}
				className="block"
			>
				<h3 className="font-semibold text-sm line-clamp-2 mb-1 hover:text-purple-400 transition-colors">
					{movieTitle}
				</h3>
				{releaseYear && <p className="text-gray-500 text-sm">{releaseYear}</p>}
			</Link>
		</div>
	);
}
