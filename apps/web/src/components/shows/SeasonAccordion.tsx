import { Check, ChevronDown, Eye, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface Season {
	id: number;
	season_number: number;
	name?: string;
	episode_count?: number;
}

interface SeasonAccordionProps {
	season: Season;
	isExpanded: boolean;
	onToggle: () => void;
	isFullyWatched: boolean;
	onMarkSeasonWatched: () => void;
	onUnmarkSeasonWatched: () => void;
	isProcessingSeason: boolean;
	isAuthenticated: boolean;
	children: ReactNode;
}

export default function SeasonAccordion({
	season,
	isExpanded,
	onToggle,
	isFullyWatched,
	onMarkSeasonWatched,
	onUnmarkSeasonWatched,
	isProcessingSeason,
	isAuthenticated,
	children,
}: SeasonAccordionProps) {
	const episodeCount = season.episode_count || 0;

	return (
		<div className="card overflow-hidden">
			<div className="flex items-center">
				{/* Toggle header */}
				<button
					type="button"
					className="flex flex-1 items-center text-left"
					onClick={onToggle}
				>
					<div className="flex flex-1 items-center justify-between p-4">
						<div>
							<h3 className="font-semibold">
								{season.name || `Season ${season.season_number}`}
							</h3>
							<p className="text-(--foreground-muted) text-sm">
								{episodeCount} episodes
							</p>
						</div>
					</div>
				</button>

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
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										Loading
									</>
								) : (
									<>
										<Check className="h-3.5 w-3.5" />
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
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										Loading
									</>
								) : (
									<>
										<Eye className="h-3.5 w-3.5" />
										Add to shelf
									</>
								)}
							</button>
						)}
					</span>
				)}

				{/* Expand/Chevron */}
				<button
					type="button"
					onClick={onToggle}
					className="flex items-center justify-center self-stretch px-4 text-(--foreground-muted) transition-colors hover:text-(--foreground)"
				>
					<ChevronDown
						className={`h-5 w-5 transition-transform ${
							isExpanded ? "rotate-180" : ""
						}`}
					/>
				</button>
			</div>

			{/* Episode List */}
			<div
				className="grid border-(--border) border-t transition-all duration-300 ease-in-out"
				style={{
					gridTemplateRows: isExpanded ? "1fr" : "0fr",
					opacity: isExpanded ? 1 : 0,
				}}
			>
				<div className="overflow-hidden">{children}</div>
			</div>
		</div>
	);
}

export type { Season };
