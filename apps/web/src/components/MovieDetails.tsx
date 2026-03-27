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
				<div
					className="p-4 rounded-lg"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container)",
					}}
				>
					<span
						className="text-sm block mb-1"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Release Date
					</span>
					<span className="font-medium" style={{ color: colors.accent }}>
						{formatDateOnly(movie.release_date)}
					</span>
				</div>
			)}
			{movie?.runtime && (
				<button
					type="button"
					onClick={() => setShowHours(!showHours)}
					className="p-4 rounded-lg text-left cursor-pointer transition-colors w-full"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container)",
					}}
				>
					<span
						className="text-sm block mb-1"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Runtime
					</span>
					<span className="font-medium" style={{ color: colors.accent }}>
						{formatRuntime(movie.runtime, showHours)}
					</span>
				</button>
			)}
			{movie?.vote_average && (
				<div
					className="p-4 rounded-lg"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container)",
					}}
				>
					<span
						className="text-sm block mb-1"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Rating
					</span>
					<span className="font-medium" style={{ color: colors.accent }}>
						{movie.vote_average.toFixed(1)}/10
					</span>
				</div>
			)}
			{movie?.vote_count && (
				<div
					className="p-4 rounded-lg"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container)",
					}}
				>
					<span
						className="text-sm block mb-1"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Votes
					</span>
					<span className="font-medium" style={{ color: colors.accent }}>
						{movie.vote_count.toLocaleString()}
					</span>
				</div>
			)}
		</section>
	);
}
