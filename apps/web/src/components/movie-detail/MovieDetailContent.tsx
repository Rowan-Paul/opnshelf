import type { FollowedWatchersDto, TmdbMovieDetailDto } from "@opnshelf/api";
import { Calendar, Clock, Star } from "lucide-react";
import { useMemo } from "react";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
import {
	type ColorTheme,
	FriendWatchersRow,
	MetadataPills,
	TrailerSection,
} from "@/components/detail";
import { GenresSection } from "@/components/GenresSection";
import { formatDateOnly, formatRuntime } from "@/lib/utils";

type MovieDetailContentProps = {
	movie?: TmdbMovieDetailDto;
	colors: ColorTheme;
	friendWatchers?: FollowedWatchersDto;
	isFriendWatchersLoading?: boolean;
};

export function MovieDetailContent({
	movie,
	colors,
	friendWatchers,
	isFriendWatchersLoading = false,
}: MovieDetailContentProps) {
	const metadataItems = useMemo(() => {
		const items = [];
		if (movie?.release_date) {
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: formatDateOnly(movie.release_date),
			});
		}
		if (movie?.runtime) {
			items.push({
				icon: <Clock className="w-4 h-4" />,
				label: formatRuntime(movie.runtime, false),
			});
		}
		if (movie?.vote_average) {
			items.push({
				icon: <Star className="w-4 h-4" />,
				label: `${movie.vote_average.toFixed(1)}/10`,
			});
		}
		return items;
	}, [movie]);

	return (
		<div className="space-y-6 min-w-0 w-full">
			<MetadataPills items={metadataItems} />
			<FriendWatchersRow
				watchers={friendWatchers}
				isLoading={isFriendWatchersLoading}
				colors={colors}
			/>

			<section>
				<h2 className="m3-title-large mb-3" style={{ color: colors.primary }}>
					Overview
				</h2>
				<p
					className="m3-body-large leading-relaxed wrap-break-word"
					style={{ color: "var(--md-sys-color-on-surface-variant)" }}
				>
					{movie?.overview || "No overview available."}
				</p>
			</section>

			<TrailerSection
				mediaType="movie"
				detailTrailer={movie?.trailer}
				titleColor={colors.primary}
			/>
			<GenresSection genres={movie?.genres} colors={colors} />
			<CastSection cast={movie?.credits?.cast} colors={colors} />
			<CrewSection crew={movie?.credits?.crew} colors={colors} />
		</div>
	);
}
