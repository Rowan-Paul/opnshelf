import type { TmdbShowDetailDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Calendar, Film } from "lucide-react";
import type { ColorTheme } from "./types";

type SeasonCardProps = {
	showId: string;
	title: string;
	seasonNumber: number;
	posterUrl?: string | null;
	airDate?: string;
	episodeCount: number;
	watchedCount: number;
	overview?: string;
	colors: ColorTheme;
	showData?: TmdbShowDetailDto;
};

export function SeasonCard({
	showId,
	title,
	seasonNumber,
	posterUrl,
	airDate,
	episodeCount,
	watchedCount,
	overview,
	colors,
}: SeasonCardProps) {
	const progress =
		episodeCount > 0 ? Math.round((watchedCount / episodeCount) * 100) : 0;

	return (
		<Link
			to="/shows/$showId/$title/seasons/$seasonNumber"
			params={{
				showId,
				title,
				seasonNumber: String(seasonNumber),
			}}
			className="group block rounded-xl border bg-gray-900/30 hover:bg-gray-900/50 transition-all overflow-hidden"
			style={{ borderColor: "var(--md-sys-color-outline)" }}
		>
			<div className="grid grid-cols-[100px_1fr] gap-4">
				<div className="aspect-2/3 bg-gray-900">
					{posterUrl ? (
						<img
							src={posterUrl}
							alt={`Season ${seasonNumber}`}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
							No poster
						</div>
					)}
				</div>
				<div className="py-3 pr-4 min-w-0">
					<div className="flex items-center justify-between gap-2 mb-1">
						<h3
							className="font-semibold text-lg group-hover:text-white transition-colors"
							style={{ color: colors.primary }}
						>
							Season {seasonNumber}
						</h3>
						{airDate && (
							<span className="text-xs text-gray-400 flex items-center gap-1">
								<Calendar className="w-3 h-3" />
								{new Date(airDate).getFullYear()}
							</span>
						)}
					</div>

					<div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
						<span className="flex items-center gap-1">
							<Film className="w-3 h-3" />
							{episodeCount} episodes
						</span>
						{watchedCount > 0 && (
							<span className="text-gray-300">{watchedCount} watched</span>
						)}
					</div>

					{overview && (
						<p className="text-xs text-gray-400 line-clamp-2 mb-3">
							{overview}
						</p>
					)}

					{episodeCount > 0 && (
						<div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
							<div
								className="h-full rounded-full transition-all"
								style={{
									width: `${progress}%`,
									background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
								}}
							/>
						</div>
					)}
				</div>
			</div>
		</Link>
	);
}
