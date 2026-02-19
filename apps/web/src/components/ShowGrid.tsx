import type { TmdbShowResultDto } from "@opnshelf/api";
import { cn } from "@/lib/utils";
import { ShowCard } from "./ShowCard";

interface ShowGridProps {
	shows: TmdbShowResultDto[];
	gridClassName?: string;
}

export function ShowGrid({ shows, gridClassName }: ShowGridProps) {
	return (
		<div
			className={cn(
				"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4",
				gridClassName,
			)}
		>
			{shows.map((show) => (
				<ShowCard key={show.id} show={show} />
			))}
		</div>
	);
}
