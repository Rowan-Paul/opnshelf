import { Skeleton } from "@/components/ui/skeleton";

interface PosterGridSkeletonProps {
	count?: number;
}

export function PosterGridSkeleton({ count = 10 }: PosterGridSkeletonProps) {
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
