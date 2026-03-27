import type { TmdbMovieDetailDto } from "@opnshelf/api";

interface GenresSectionProps {
	genres: TmdbMovieDetailDto["genres"];
	colors: {
		primary?: string;
		accent?: string;
	};
}

export function GenresSection({ genres, colors }: GenresSectionProps) {
	if (!genres || genres.length === 0) return null;

	return (
		<section>
			<h2
				className="text-xl font-semibold mb-3"
				style={{ color: colors.primary }}
			>
				Genres
			</h2>
			<div className="flex flex-wrap gap-2">
				{genres.map((genre) => (
					<span
						key={genre.id}
						className="px-4 py-2 rounded-full text-sm font-medium"
						style={{
							backgroundColor: `color-mix(in srgb, ${colors.primary} 12%, transparent)`,
							color: colors.accent,
							border: `1px solid color-mix(in srgb, ${colors.primary} 25%, transparent)`,
						}}
					>
						{genre.name}
					</span>
				))}
			</div>
		</section>
	);
}
