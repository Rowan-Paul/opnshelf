import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Eye } from "lucide-react";

interface Season {
	id: number;
	season_number: number;
	name?: string;
	episode_count?: number;
}

interface SeasonRowProps {
	season: Season;
	showId: string;
	showName: string;
	isFullyWatched: boolean;
	progress?: { episodesWatched: number; episodesTotal: number };
	onMarkSeasonWatched: () => void;
	onUnmarkSeasonWatched: () => void;
	isProcessingSeason: boolean;
	isAuthenticated: boolean;
}

export default function SeasonRow({
	season,
	showId,
	showName,
	isFullyWatched,
	progress,
	onMarkSeasonWatched,
	onUnmarkSeasonWatched,
	isProcessingSeason,
	isAuthenticated,
}: SeasonRowProps) {
	const episodeCount = season.episode_count || 0;

	return (
		<div className="card overflow-hidden">
			<div className="flex items-center">
				{/* Season details */}
				<Link
					to="/shows/$showId/$showName/seasons/$seasonNumber"
					params={{
						showId,
						showName,
						seasonNumber: String(season.season_number),
					}}
					className="flex flex-1 items-center text-left"
				>
					<div className="flex flex-1 items-center justify-between p-4">
						<div>
							<h3 className="font-semibold">
								{season.name || `Season ${season.season_number}`}
							</h3>
							<p className="text-(--foreground-muted) text-sm">
								{progress
									? `${progress.episodesWatched} of ${progress.episodesTotal} episodes watched`
									: `${episodeCount} episodes`}
							</p>
						</div>
					</div>
					<ChevronRight className="mr-4 size-5 shrink-0" />
				</Link>

				{/* Season Actions */}
				{isAuthenticated && episodeCount > 0 && (
					<span className="flex items-center gap-1 pr-2">
						{isFullyWatched ? (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onUnmarkSeasonWatched();
								}}
								disabled={isProcessingSeason}
								className="flex items-center gap-1.5 rounded-md bg-green-500/10 px-3 py-1.5 font-medium text-green-600 text-xs transition-colors hover:bg-green-500/20"
								title="Remove all episodes of this season from shelf"
							>
								{isProcessingSeason ? (
									<>
										<span className="h-3.5 w-3.5 animate-pulse rounded bg-current opacity-30" />
										Loading
									</>
								) : (
									<>
										<Check className="size-3.5" />
										On shelf
									</>
								)}
							</button>
						) : (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onMarkSeasonWatched();
								}}
								disabled={isProcessingSeason}
								className="flex items-center gap-1.5 rounded-md bg-(--background-subtle) px-3 py-1.5 font-medium text-(--foreground-muted) text-xs transition-colors hover:bg-(--accent-subtle) hover:text-(--accent)"
								title="Add all episodes in this season to your shelf"
							>
								{isProcessingSeason ? (
									<>
										<span className="h-3.5 w-3.5 animate-pulse rounded bg-current opacity-30" />
										Loading
									</>
								) : (
									<>
										<Eye className="size-3.5" />
										{progress && progress.episodesWatched > 0
											? "Mark remaining watched"
											: "Add to shelf"}
									</>
								)}
							</button>
						)}
					</span>
				)}
			</div>
		</div>
	);
}

export type { Season };
