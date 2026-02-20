import type { UserDto } from "@opnshelf/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MovieCardData } from "./MovieCard";
import { MovieCard } from "./MovieCard";

interface MovieGridProps {
	movies: MovieCardData[];
	user: UserDto | null | undefined;
	watchedMovieIds: Set<string>;
	showActions?: boolean;
	gridClassName?: string;
}

export function MovieGrid({
	movies,
	user,
	watchedMovieIds,
	showActions = true,
	gridClassName,
}: MovieGridProps) {
	return (
		<div
			className={cn(
				"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4",
				gridClassName,
			)}
		>
			{movies.map((movie) => (
				<MovieCard
					key={movie.id}
					movie={movie}
					user={user}
					isWatched={watchedMovieIds.has(movie.id.toString())}
					showActions={showActions}
				/>
			))}
		</div>
	);
}

interface MovieGridSkeletonProps {
	count?: number;
}

export function MovieGridSkeleton({ count = 10 }: MovieGridSkeletonProps) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
			{Array.from({ length: count }, (_, i) => i).map((index) => (
				<div key={`skeleton-${index}`}>
					<Skeleton className="aspect-2/3 rounded-lg mb-2" />
					<Skeleton className="h-4 w-3/4 mb-1" />
					<Skeleton className="h-3 w-1/2" />
				</div>
			))}
		</div>
	);
}
