import { Link } from "@tanstack/react-router";
import { Calendar, Star } from "lucide-react";
import { formatDateOnly } from "@/lib/utils";
import type { ColorTheme, EpisodeSummary } from "./types";

type EpisodeCardProps = {
	showId: string;
	title: string;
	seasonNumber: string;
	episode: EpisodeSummary;
	watchedCount?: number;
	colors: ColorTheme;
};

export function EpisodeCard({
	showId,
	title,
	seasonNumber,
	episode,
	watchedCount = 0,
	colors,
}: EpisodeCardProps) {
	return (
		<Link
			to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
			params={{
				showId,
				title,
				seasonNumber,
				episodeNumber: String(episode.episode_number),
			}}
			className="group block rounded-xl border bg-gray-900/30 hover:bg-gray-900/50 transition-all overflow-hidden"
			style={{
				borderColor:
					watchedCount > 0
						? `${colors.primary}40`
						: "var(--md-sys-color-outline)",
			}}
		>
			<div className="grid grid-cols-[120px_1fr] gap-4">
				<div className="h-full bg-gray-900 min-h-[67px]">
					{episode.still_path ? (
						<img
							src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
							alt={episode.name}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
							No image
						</div>
					)}
				</div>
				<div className="p-3 min-w-0">
					<div className="flex items-center justify-between gap-2 mb-1">
						<p className="font-medium line-clamp-1 group-hover:text-white transition-colors">
							E{episode.episode_number} · {episode.name}
						</p>
						{episode.vote_average ? (
							<span className="text-xs flex items-center gap-1 text-gray-300">
								<Star className="w-3 h-3" />
								{episode.vote_average.toFixed(1)}
							</span>
						) : null}
					</div>
					<p className="text-xs text-gray-400 line-clamp-2 mb-2">
						{episode.overview || "No overview available."}
					</p>
					<div className="flex items-center gap-3 text-xs text-gray-400">
						<span className="flex items-center gap-1">
							<Calendar className="w-3 h-3" />
							{episode.air_date ? formatDateOnly(episode.air_date) : "TBA"}
						</span>
						{watchedCount > 0 && (
							<span
								className="flex items-center gap-1"
								style={{ color: colors.primary }}
							>
								{watchedCount} watched
							</span>
						)}
					</div>
				</div>
			</div>
		</Link>
	);
}
