import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

type SeasonNavProps = {
	showId: string;
	title: string;
	currentSeason: number;
	totalSeasons: number;
};

export function SeasonNav({
	showId,
	title,
	currentSeason,
	totalSeasons,
}: SeasonNavProps) {
	const hasPrev = currentSeason > 1;
	const hasNext = currentSeason < totalSeasons;

	if (!hasPrev && !hasNext) {
		return null;
	}

	return (
		<div className="flex gap-2">
			{hasPrev ? (
				<Link
					to="/shows/$showId/$title/seasons/$seasonNumber"
					params={{
						showId,
						title,
						seasonNumber: String(currentSeason - 1),
					}}
					className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-(--md-sys-color-outline) hover:bg-(--md-sys-color-surface-container)/40 transition-colors text-sm"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Season {currentSeason - 1}</span>
				</Link>
			) : (
				<div className="flex-1" />
			)}

			{hasNext ? (
				<Link
					to="/shows/$showId/$title/seasons/$seasonNumber"
					params={{
						showId,
						title,
						seasonNumber: String(currentSeason + 1),
					}}
					className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-(--md-sys-color-outline) hover:bg-(--md-sys-color-surface-container)/40 transition-colors text-sm"
				>
					<span>Season {currentSeason + 1}</span>
					<ArrowRight className="w-4 h-4" />
				</Link>
			) : (
				<div className="flex-1" />
			)}
		</div>
	);
}
