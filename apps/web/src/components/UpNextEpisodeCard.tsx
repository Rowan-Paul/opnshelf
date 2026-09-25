import { slugifyName, type UpNextShowDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Plus, Tv } from "lucide-react";
import { useState } from "react";
import {
	PosterProgress,
	type PosterProgressValue,
} from "#/components/PosterProgress";
import { useMarkEpisodeWatched } from "#/lib/hooks";

/** Episode tile for the profile queue. Each card owns its pending action. */
export function UpNextEpisodeCard({
	item,
	isOwner,
	progress,
	isProgressLoading,
}: {
	item: UpNextShowDto;
	isOwner: boolean;
	progress?: PosterProgressValue;
	isProgressLoading?: boolean;
}) {
	const markEpisode = useMarkEpisodeWatched();
	const [failedImages, setFailedImages] = useState<string[]>([]);
	const { show, nextEpisode: episode } = item;
	const imagePath = [episode.stillPath, show.backdropPath].find(
		(path) => path && !failedImages.includes(path),
	);
	const params = {
		showId: item.showId,
		showName: slugifyName(show.title),
		seasonNumber: String(episode.seasonNumber),
		episodeNumber: String(episode.episodeNumber),
	};
	return (
		<article className="card flex min-w-0 flex-col overflow-hidden">
			<Link
				to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
				params={params}
				className="relative block aspect-video overflow-hidden bg-slate-800 focus-visible:outline-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2"
			>
				{imagePath ? (
					<img
						src={`https://image.tmdb.org/t/p/w780${imagePath}`}
						alt=""
						loading="lazy"
						className="size-full object-cover"
						onError={() => setFailedImages((paths) => [...paths, imagePath])}
					/>
				) : (
					<Tv
						aria-hidden="true"
						className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-slate-500"
					/>
				)}
				<div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/15 to-transparent" />
				<div className="absolute inset-x-0 bottom-0 p-4">
					<span className="text-white/85 text-xs">
						S{episode.seasonNumber} · E{episode.episodeNumber}
					</span>
					<h2 className="mt-1 line-clamp-2 font-semibold text-white">
						{show.title}
					</h2>
				</div>
				<PosterProgress
					progress={progress}
					label="Show progress"
					isLoading={isProgressLoading}
				/>
			</Link>
			<div className="flex flex-1 flex-col gap-3 p-4">
				<Link
					to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
					params={params}
					className="line-clamp-2 font-medium text-sm hover:text-(--accent)"
				>
					{episode.name || `Episode ${episode.episodeNumber}`}
				</Link>
				{episode.overview && (
					<p className="line-clamp-3 text-(--foreground-muted) text-sm leading-relaxed">
						{episode.overview}
					</p>
				)}
				<div className="mt-auto flex flex-wrap items-center justify-between gap-2">
					{isProgressLoading ? (
						<div
							className="h-3 w-28 animate-pulse rounded bg-(--background-subtle)"
							aria-hidden="true"
						/>
					) : progress && progress.episodesTotal > 0 ? (
						<p className="text-(--foreground-muted) text-xs tabular-nums">
							{progress.episodesWatched} of {progress.episodesTotal} watched
						</p>
					) : (
						<span />
					)}
					{isOwner && (
						<button
							type="button"
							disabled={markEpisode.isPending}
							aria-busy={markEpisode.isPending}
							className="btn btn-primary shrink-0 gap-2 text-sm"
							onClick={() =>
								markEpisode.mutate({
									body: {
										showId: item.showId,
										seasonNumber: episode.seasonNumber,
										episodeNumber: episode.episodeNumber,
									},
								})
							}
						>
							<Plus className="size-4" aria-hidden="true" />
							{markEpisode.isPending ? "Adding…" : "Add to shelf"}
						</button>
					)}
				</div>
			</div>
		</article>
	);
}
