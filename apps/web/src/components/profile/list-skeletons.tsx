import { PosterGridSkeleton } from "#/components/skeletons";
import { cn } from "#/lib/utils";

// Route pendingComponents import these, and pending components are not code
// split, so this module stays free of the heavy list pages they stand in for.

/** Cards and their skeleton share this, so the placeholder lands on the real shape. */
export const OVERVIEW_GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
export const COVER_BAND = "relative h-32 bg-(--background-subtle)";
/** Width the poster occupies, plus its gutter — the text column starts here. */
export const COVER_INSET = "pl-[7.5rem]";
// Same columns and gutters as the Shelf page, so a poster is the same size
// wherever the reader meets it.
export const LIST_ITEMS_GRID =
	"grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6";

export function ListCardSkeleton({ count = 3 }: { count?: number }) {
	const pulse = "animate-pulse rounded bg-(--background-subtle)";
	return (
		<div className={OVERVIEW_GRID}>
			{Array.from({ length: count }, (_, i) => i).map((i) => (
				<div
					key={i}
					className="overflow-hidden rounded-2xl border border-(--border)"
				>
					<div className={cn(COVER_BAND, "animate-pulse")}>
						{/* Stands where the poster does, overhang included. */}
						<div className="absolute bottom-[-1rem] left-4 h-36 w-24 rounded-md bg-(--border)" />
						<div className="absolute right-4 bottom-3 left-[7.5rem] h-4 w-1/2 rounded bg-(--border)" />
					</div>
					<div className={cn("space-y-2 p-4", COVER_INSET)}>
						<div className={cn("h-3 w-4/5", pulse)} />
						<div className={cn("h-3 w-1/3", pulse)} />
					</div>
				</div>
			))}
		</div>
	);
}

export function ListDetailSkeleton() {
	const pulse = "animate-pulse rounded bg-(--background-subtle)";
	return (
		<div className="space-y-5">
			{/* Same running order as the real page — back link, toolbar,
			    description, controls, grid — so nothing below shifts when the list
			    lands. A list with no description costs one line of drift; leaving
			    the line out costs it for every list that has one. */}
			<div className={cn("h-5 w-20", pulse)} />
			<div className="space-y-6">
				<div className="-mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-(--border) border-b py-3">
					<div className={cn("h-7 w-40", pulse)} />
					<div className={cn("h-3 w-32", pulse)} />
					<div className={cn("h-3 w-36", pulse)} />
				</div>
				<div className={cn("h-5 w-2/5", pulse)} />
				<div className="space-y-3">
					<div className={cn("h-10 w-full", pulse)} />
					<div className="flex gap-2">
						<div className={cn("h-8 w-20 rounded-full", pulse)} />
						<div className={cn("ml-auto h-8 w-24 rounded-full", pulse)} />
					</div>
					<div className="flex flex-wrap gap-2">
						{["all", "movies", "shows", "unwatched"].map((key) => (
							<div key={key} className={cn("h-8 w-20 rounded-full", pulse)} />
						))}
					</div>
				</div>
				<PosterGridSkeleton gridClassName={LIST_ITEMS_GRID} />
			</div>
		</div>
	);
}
