import type { TmdbMovieDetailDto } from "@opnshelf/api";
import { useState } from "react";
import { formatDateOnly, formatRuntime } from "@/lib/utils";

interface MovieDetailsProps {
	movie: TmdbMovieDetailDto | undefined;
	colors: {
		primary?: string;
		accent?: string;
	};
}

export function MovieDetails({ movie, colors }: MovieDetailsProps) {
	const [showHours, setShowHours] = useState(false);

	return (
		<section className="grid grid-cols-2 gap-4 min-w-0">
			{movie?.release_date && (
				<div className="p-4 rounded-lg bg-gray-900/50">
					<span className="text-gray-500 text-sm block mb-1">Release Date</span>
					<span className="font-medium" style={{ color: colors.accent }}>
						{formatDateOnly(movie.release_date)}
					</span>
				</div>
			)}
			{movie?.runtime && (
				<button
					type="button"
					onClick={() => setShowHours(!showHours)}
					className="p-4 rounded-lg bg-gray-900/50 text-left cursor-pointer hover:bg-gray-800/50 transition-colors w-full"
				>
					<span className="text-gray-500 text-sm block mb-1">Runtime</span>
					<span className="font-medium" style={{ color: colors.accent }}>
						{formatRuntime(movie.runtime, showHours)}
					</span>
				</button>
			)}
			{movie?.vote_average && (
				<div className="p-4 rounded-lg bg-gray-900/50">
					<span className="text-gray-500 text-sm block mb-1">Rating</span>
					<span className="font-medium" style={{ color: colors.accent }}>
						{movie.vote_average.toFixed(1)}/10
					</span>
				</div>
			)}
			{movie?.vote_count && (
				<div className="p-4 rounded-lg bg-gray-900/50">
					<span className="text-gray-500 text-sm block mb-1">Votes</span>
					<span className="font-medium" style={{ color: colors.accent }}>
						{movie.vote_count.toLocaleString()}
					</span>
				</div>
			)}
		</section>
	);
}
