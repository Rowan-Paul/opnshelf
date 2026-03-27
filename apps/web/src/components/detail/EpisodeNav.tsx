import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CircleDot } from "lucide-react";
import { formatDateOnly } from "@/lib/utils";
import type { ColorTheme, EpisodeSummary } from "./types";

type EpisodeContext = {
	seasonNumber: number;
	episodeNumber: number;
};

type EpisodeNavProps = {
	showId: string;
	title: string;
	seasonNumber: string;
	previousEpisode: EpisodeSummary | null;
	currentEpisode: EpisodeSummary;
	nextEpisode: EpisodeSummary | null;
	colors: ColorTheme;
	variant?: "sidebar" | "full";
	previousContext?: EpisodeContext | null;
	nextContext?: EpisodeContext | null;
};

export function EpisodeNav({
	showId,
	title,
	seasonNumber,
	previousEpisode,
	currentEpisode,
	nextEpisode,
	colors,
	variant = "full",
	previousContext,
	nextContext,
}: EpisodeNavProps) {
	if (variant === "sidebar") {
		const hasPrev = previousEpisode !== null;
		const hasNext = nextEpisode !== null;

		if (!hasPrev && !hasNext) {
			return null;
		}

		return (
			<div className="flex gap-2">
				{hasPrev ? (
					<Link
						to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
						params={{
							showId,
							title,
							seasonNumber: String(
								previousContext?.seasonNumber ?? seasonNumber,
							),
							episodeNumber: String(previousEpisode.episode_number),
						}}
						className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-(--md-sys-color-outline) hover:bg-(--md-sys-color-surface-container)/40 transition-colors text-sm"
					>
						<ArrowLeft className="w-4 h-4" />
						<span>Episode {previousEpisode.episode_number}</span>
					</Link>
				) : (
					<div className="flex-1" />
				)}

				{hasNext ? (
					<Link
						to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
						params={{
							showId,
							title,
							seasonNumber: String(nextContext?.seasonNumber ?? seasonNumber),
							episodeNumber: String(nextEpisode.episode_number),
						}}
						className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-(--md-sys-color-outline) hover:bg-(--md-sys-color-surface-container)/40 transition-colors text-sm"
					>
						<span>Episode {nextEpisode.episode_number}</span>
						<ArrowRight className="w-4 h-4" />
					</Link>
				) : (
					<div className="flex-1" />
				)}
			</div>
		);
	}
	const slots = [
		{
			key: "previous",
			label: "Previous Episode",
			icon: <ArrowLeft className="w-4 h-4" />,
			episode: previousEpisode,
			context: previousContext,
			highlighted: false,
		},
		{
			key: "current",
			label: "Current Episode",
			icon: <CircleDot className="w-4 h-4" />,
			episode: currentEpisode,
			context: {
				seasonNumber: Number(seasonNumber),
				episodeNumber: currentEpisode.episode_number,
			},
			highlighted: true,
		},
		{
			key: "next",
			label: "Next Episode",
			icon: <ArrowRight className="w-4 h-4" />,
			episode: nextEpisode,
			context: nextContext,
			highlighted: false,
		},
	];

	return (
		<section>
			<h2
				className="text-xl font-semibold mb-3"
				style={{ color: colors.primary }}
			>
				More In This Season
			</h2>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
				{slots.map((slot) => {
					if (!slot.episode) {
						return (
							<div
								key={slot.key}
								className="rounded-lg border p-3 opacity-50"
								style={{
									borderColor: "var(--md-sys-color-outline)",
								}}
							>
								<div className="text-xs uppercase tracking-wide text-(--md-sys-color-on-surface-variant) mb-2 flex items-center gap-2">
									{slot.icon}
									{slot.label}
								</div>
								<div className="text-(--md-sys-color-on-surface-variant) text-sm">
									No episode
								</div>
							</div>
						);
					}

					return (
						<Link
							key={slot.key}
							to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
							params={{
								showId,
								title,
								seasonNumber: String(
									slot.context?.seasonNumber ?? seasonNumber,
								),
								episodeNumber: String(slot.episode.episode_number),
							}}
							className={`rounded-lg border p-3 transition-colors ${
								slot.highlighted
									? "bg-(--md-sys-color-surface-container)/60 hover:bg-(--md-sys-color-surface-container)/70"
									: "bg-(--md-sys-color-surface-container)/30 hover:bg-(--md-sys-color-surface-container)/50"
							}`}
							style={{
								borderColor: slot.highlighted
									? colors.primary
									: "var(--md-sys-color-outline)",
							}}
						>
							<div className="text-xs uppercase tracking-wide text-(--md-sys-color-on-surface-variant) mb-2 flex items-center gap-2">
								{slot.icon}
								{slot.label}
							</div>
							<div
								className={`rounded-md px-2 py-2 ${slot.highlighted ? "" : ""}`}
								style={
									slot.highlighted
										? {
												backgroundColor: `${colors.primary}15`,
											}
										: {}
								}
							>
								<div className="font-medium text-sm">
									E{slot.episode.episode_number}: {slot.episode.name}
								</div>
								<div className="text-xs text-(--md-sys-color-on-surface-variant) mt-1">
									{slot.episode.air_date
										? formatDateOnly(slot.episode.air_date)
										: "TBA"}
								</div>
							</div>
						</Link>
					);
				})}
			</div>
		</section>
	);
}
