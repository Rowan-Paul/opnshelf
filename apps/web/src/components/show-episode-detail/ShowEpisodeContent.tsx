import type { TmdbEpisodeDto, TmdbShowDetailDto } from "@opnshelf/api";
import { Calendar, Clock, Film, Layers, Star } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
import {
	type ColorTheme,
	MetadataPills,
	TrailerSection,
} from "@/components/detail";
import { formatDateOnly, formatRuntime } from "@/lib/utils";

type ShowEpisodeContentProps = {
	show?: TmdbShowDetailDto;
	episode?: TmdbEpisodeDto;
	showId: string;
	title: string;
	seasonNumber: string;
	episodeNumber: string;
	colors: ColorTheme;
};

export function ShowEpisodeContent({
	show,
	episode,
	showId,
	title,
	seasonNumber,
	episodeNumber,
	colors,
}: ShowEpisodeContentProps) {
	const metadataItems = useMemo(() => {
		const items: Array<{
			icon?: ReactNode;
			label: string;
			linkTo?: { to: string; params: Record<string, string> };
		}> = [];

		items.push({
			icon: <Layers className="w-4 h-4" />,
			label: `Season ${seasonNumber}`,
			linkTo: {
				to: "/shows/$showId/$title/seasons/$seasonNumber",
				params: { showId, title, seasonNumber },
			},
		});
		items.push({
			icon: <Film className="w-4 h-4" />,
			label: `Episode ${episodeNumber}`,
		});
		if (episode?.air_date) {
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: formatDateOnly(episode.air_date),
			});
		}
		if (episode?.vote_average) {
			items.push({
				icon: <Star className="w-4 h-4" />,
				label: `${episode.vote_average.toFixed(1)}/10`,
			});
		}
		if (episode?.runtime) {
			items.push({
				icon: <Clock className="w-4 h-4" />,
				label: formatRuntime(episode.runtime, false),
			});
		}
		return items;
	}, [episode, seasonNumber, episodeNumber, showId, title]);

	return (
		<div className="space-y-6 min-w-0">
			<MetadataPills items={metadataItems} />

			<section>
				<h2
					className="text-xl font-semibold mb-3"
					style={{ color: colors.primary }}
				>
					Overview
				</h2>
				<p className="text-gray-300 leading-relaxed mb-4">
					{episode?.overview || "No overview available."}
				</p>
			</section>

			<TrailerSection
				mediaType="episode"
				detailTrailer={episode?.trailer}
				showTrailer={show?.trailer}
				titleColor={colors.primary}
			/>
			<CastSection
				cast={show?.credits?.cast}
				guestStars={episode?.guest_stars}
				colors={colors}
			/>
			<CrewSection crew={show?.credits?.crew} colors={colors} />
		</div>
	);
}
