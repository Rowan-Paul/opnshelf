import {
	getYouTubeEmbedUrl,
	getYouTubeThumbnailUrl,
	resolveDetailTrailer,
	type TmdbTrailerDto,
} from "@opnshelf/api";
import { Play } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type TrailerSectionProps = {
	mediaType: "movie" | "show" | "season" | "episode";
	detailTrailer?: TmdbTrailerDto;
	showTrailer?: TmdbTrailerDto;
	titleColor?: string;
};

export function TrailerSection({
	mediaType,
	detailTrailer,
	showTrailer,
	titleColor,
}: TrailerSectionProps) {
	const [isPlaying, setIsPlaying] = useState(false);
	const resolvedTrailer = resolveDetailTrailer({
		mediaType,
		detailTrailer,
		showTrailer,
	});

	if (!resolvedTrailer) {
		return null;
	}

	const { trailer, isFallback } = resolvedTrailer;

	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-base font-semibold" style={{ color: titleColor }}>
					Trailer
				</h2>
				{isFallback ? <Badge variant="outline">From show</Badge> : null}
			</div>

			<div className="max-w-3xl overflow-hidden rounded-[1.25rem] border border-white/8 bg-black/20">
				<div className="aspect-video w-full bg-black">
					{isPlaying ? (
						<iframe
							className="h-full w-full"
							src={getYouTubeEmbedUrl(trailer.key, { autoplay: true })}
							title={trailer.name}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						/>
					) : (
						<button
							type="button"
							className="group relative h-full w-full cursor-pointer overflow-hidden text-left"
							onClick={() => setIsPlaying(true)}
						>
							<img
								src={getYouTubeThumbnailUrl(trailer.key)}
								alt={trailer.name}
								className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
							<div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
								<div className="space-y-1">
									<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
										Watch trailer
									</p>
									<p className="text-base font-medium text-white">
										{trailer.name}
									</p>
								</div>
								<span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition group-hover:bg-black/55">
									<Play className="ml-0.5 size-4 fill-current" />
								</span>
							</div>
						</button>
					)}
				</div>
			</div>
		</section>
	);
}
