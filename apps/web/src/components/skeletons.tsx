/** Shape-matched loading placeholders (preferred over spinners for content
 * areas): they preserve layout so nothing jumps when real content arrives. */

const IDX = (n: number) => Array.from({ length: n }, (_, i) => i);

const PULSE = "animate-pulse rounded bg-(--background-subtle)";

/** Poster grid (search results, shelf/library/list pages). */
export function PosterGridSkeleton({
	count = 12,
	gridClassName = "grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
}: {
	count?: number;
	/** Override the responsive column classes to match a specific real grid. */
	gridClassName?: string;
}) {
	return (
		<div className={`grid ${gridClassName}`}>
			{IDX(count).map((i) => (
				<div key={i}>
					<div className={`aspect-[2/3] rounded-lg ${PULSE}`} />
					<div className={`mt-2 h-3 w-4/5 ${PULSE}`} />
				</div>
			))}
		</div>
	);
}

/** Bordered rows with two text lines (lists, settings option rows). */
export function RowListSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div className="space-y-2">
			{IDX(rows).map((i) => (
				<div key={i} className="rounded-xl border border-(--border) p-4">
					<div className={`h-3.5 w-2/5 ${PULSE}`} />
					<div className={`mt-2 h-2.5 w-1/4 ${PULSE}`} />
				</div>
			))}
		</div>
	);
}

/** Avatar + two text lines (following, connections, people). */
export function UserRowsSkeleton({ rows = 4 }: { rows?: number }) {
	return (
		<div className="space-y-2">
			{IDX(rows).map((i) => (
				<div
					key={i}
					className="flex items-center gap-3 rounded-xl border border-(--border) p-4"
				>
					<div className={`size-12 rounded-full ${PULSE}`} />
					<div className="flex-1 space-y-2">
						<div className={`h-3 w-1/3 ${PULSE}`} />
						<div className={`h-2.5 w-1/4 ${PULSE}`} />
					</div>
				</div>
			))}
		</div>
	);
}

/** Card rows with thumb + text lines (activity feeds, episode lists). */
export function CardRowsSkeleton({ rows = 4 }: { rows?: number }) {
	return (
		<div className="space-y-3">
			{IDX(rows).map((i) => (
				<div
					key={i}
					className="flex gap-3 rounded-xl border border-(--border) p-3"
				>
					<div className={`h-24 w-16 shrink-0 rounded-md ${PULSE}`} />
					<div className="flex flex-1 flex-col justify-center space-y-2">
						<div className={`h-3 w-3/4 ${PULSE}`} />
						<div className={`h-2.5 w-1/2 ${PULSE}`} />
						<div className={`h-2.5 w-2/3 ${PULSE}`} />
					</div>
				</div>
			))}
		</div>
	);
}

/** Release Calendar page: mirrors both the mobile week list and the desktop
 * grid + sidebar so nothing jumps once the real data lands. */
export function CalendarSkeleton() {
	return (
		<>
			{/* Mobile: Week Navigation */}
			<div className="mb-6 flex items-center justify-between lg:hidden">
				<div className={`size-12 rounded-lg ${PULSE}`} />
				<div className={`h-6 w-32 ${PULSE}`} />
				<div className={`size-12 rounded-lg ${PULSE}`} />
			</div>

			{/* Mobile: Week List View */}
			<div className="space-y-6 lg:hidden">
				{IDX(3).map((i) => (
					<section key={i}>
						<div className={`mb-3 h-5 w-24 ${PULSE}`} />
						<div className="space-y-3">
							{IDX(2).map((j) => (
								<div
									key={j}
									className="flex items-center gap-3 rounded-xl border border-(--border) p-3"
								>
									<div className={`h-24 w-16 shrink-0 rounded-md ${PULSE}`} />
									<div className="min-w-0 flex-1 space-y-2">
										<div className={`h-3.5 w-3/4 ${PULSE}`} />
										<div className={`h-3 w-1/3 ${PULSE}`} />
									</div>
								</div>
							))}
						</div>
					</section>
				))}
			</div>

			{/* Desktop: Calendar Grid + Sidebar */}
			<div className="hidden gap-8 lg:grid lg:grid-cols-3">
				<div className="lg:col-span-2">
					<div
						data-testid="calendar-skeleton-weekdays"
						className="mb-2 grid grid-cols-7 gap-1"
					>
						{IDX(7).map((i) => (
							<div key={i} className={`h-5 ${PULSE}`} />
						))}
					</div>
					<div
						data-testid="calendar-skeleton-days"
						className="grid grid-cols-7 gap-1"
					>
						{IDX(35).map((i) => (
							<div key={i} className={`h-24 rounded-lg ${PULSE}`} />
						))}
					</div>
				</div>

				<div className="space-y-3">
					<div className={`mb-4 h-6 w-40 ${PULSE}`} />
					{IDX(4).map((i) => (
						<div
							key={i}
							className="flex items-center gap-3 rounded-xl border border-(--border) p-3"
						>
							<div className={`h-16 w-12 shrink-0 rounded-md ${PULSE}`} />
							<div className="min-w-0 flex-1 space-y-2">
								<div className={`h-3 w-2/3 ${PULSE}`} />
								<div className={`h-2.5 w-1/3 ${PULSE}`} />
							</div>
						</div>
					))}
				</div>
			</div>
		</>
	);
}

/** Full detail page (movie/show/season/episode/person): mirrors MediaHero —
 * backdrop band, poster + title block, action row, then overview lines. */
export function DetailPageSkeleton() {
	return (
		<div className="relative z-10 min-h-[50vh]">
			<div className="container-app pt-8">
				<div className={`h-4 w-48 ${PULSE}`} />
				<div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
					<div className="hidden lg:block">
						<div className={`aspect-[2/3] rounded-xl ${PULSE}`} />
					</div>
					<div className="flex flex-col justify-end pb-8 lg:pb-16">
						<div className="mb-6 flex gap-4 lg:hidden">
							<div className={`h-40 w-28 shrink-0 rounded-lg ${PULSE}`} />
							<div className="flex flex-col justify-center gap-2">
								<div className={`h-6 w-48 ${PULSE}`} />
								<div className={`h-4 w-32 ${PULSE}`} />
							</div>
						</div>
						<div className={`hidden h-10 w-2/3 lg:block ${PULSE}`} />
						<div className="mt-4 flex gap-3">
							<div className={`h-4 w-16 ${PULSE}`} />
							<div className={`h-4 w-24 ${PULSE}`} />
							<div className={`h-4 w-20 ${PULSE}`} />
						</div>
						<div className="mt-6 flex gap-2 lg:gap-3">
							<div className={`h-10 w-36 rounded-md ${PULSE}`} />
							{IDX(4).map((i) => (
								<div key={i} className={`size-10 rounded-md ${PULSE}`} />
							))}
						</div>
					</div>
				</div>
				<div className="mt-8 space-y-2">
					<div className={`h-3 w-full max-w-2xl ${PULSE}`} />
					<div className={`h-3 w-full max-w-2xl ${PULSE}`} />
					<div className={`h-3 w-2/3 max-w-2xl ${PULSE}`} />
				</div>
			</div>
		</div>
	);
}
