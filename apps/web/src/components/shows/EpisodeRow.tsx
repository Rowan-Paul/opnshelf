import { Link } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "#/lib/auth-context";
import { withUserLocale } from "#/lib/date-utils";

interface Episode {
	id: number;
	episode_number: number;
	name: string;
	runtime?: number;
	air_date?: string;
}

interface EpisodeRowProps {
	episode: Episode;
	showId: string;
	showName: string;
	seasonNumber: number;
	isWatched: boolean;
	isUpNext: boolean;
	isProcessing: boolean;
	isUnmarking: boolean;
	onMarkWatched: () => void;
	onUnmarkWatched: () => void;
	isLast?: boolean;
}

function formatRuntime(minutes: number): string {
	if (!minutes || minutes <= 0) return "N/A";
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours === 0) return `${mins}m`;
	return `${hours}h ${mins}m`;
}

function formatDate(dateString: string, timezone?: string): string {
	if (!dateString) return "";
	try {
		return new Date(dateString).toLocaleDateString(
			"en-US",
			withUserLocale(
				{ month: "long", day: "numeric", year: "numeric" },
				timezone,
			),
		);
	} catch {
		return dateString;
	}
}

export default function EpisodeRow({
	episode,
	showId,
	showName,
	seasonNumber,
	isWatched,
	isUpNext,
	isProcessing,
	isUnmarking,
	onMarkWatched,
	onUnmarkWatched,
	isLast = false,
}: EpisodeRowProps) {
	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;

	return (
		<Link
			to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
			params={{
				showId,
				showName,
				seasonNumber: String(seasonNumber),
				episodeNumber: String(episode.episode_number),
			}}
			className={`flex items-center gap-4 p-4 transition-colors ${
				isUpNext
					? "bg-[var(--accent-subtle)]"
					: "hover:bg-[var(--background-subtle)]"
			} ${!isLast ? "border-b border-[var(--border)]" : ""}`}
		>
			<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--background-subtle)] font-semibold text-sm">
				{isWatched ? (
					<Check className="h-5 w-5 text-green-500" />
				) : (
					episode.episode_number
				)}
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<h4 className="font-medium truncate">{episode.name}</h4>
					{isUpNext && <span className="badge badge-accent">Up Next</span>}
				</div>
				<p className="text-sm text-[var(--foreground-muted)]">
					{formatRuntime(episode.runtime || 0)}
					{episode.air_date &&
						` • ${formatDate(episode.air_date, userTimezone)}`}
				</p>
			</div>
			{isWatched ? (
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onUnmarkWatched();
					}}
					disabled={isUnmarking}
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
					title="Remove from shelf"
				>
					{isUnmarking ? (
						<>
							<Loader2 className="h-3 w-3 animate-spin" />
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
						e.preventDefault();
						e.stopPropagation();
						onMarkWatched();
					}}
					disabled={isProcessing}
					className="btn btn-secondary h-8 px-3 text-xs"
					title="Add to shelf"
				>
					{isProcessing ? (
						<>
							<Loader2 className="h-3 w-3 animate-spin" />
							Loading
						</>
					) : (
						"Add to shelf"
					)}
				</button>
			)}
		</Link>
	);
}

export type { Episode };
