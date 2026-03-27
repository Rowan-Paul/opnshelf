import type { TmdbMovieDetailDto } from "@opnshelf/api";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { useState } from "react";
import {
	formatRuntime,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
} from "@/lib/utils";

interface MovieHeroProps {
	movie: TmdbMovieDetailDto | undefined;
	isLoading?: boolean;
}

export function MovieHero({ movie, isLoading }: MovieHeroProps) {
	const router = useRouter();
	const [showHours, setShowHours] = useState(false);

	const backdropUrl = getTmdbBackdropUrl(movie?.backdrop_path);
	const posterUrl = getTmdbPosterUrl(movie?.poster_path, "w500");
	const releaseYear = movie?.release_date
		? new Date(movie.release_date).getFullYear()
		: null;

	const colors = movie?.colors || {
		primary: "var(--md-sys-color-primary)",
		secondary: "var(--md-sys-color-primary-container)",
		accent: "var(--md-sys-color-on-primary-container)",
		muted: "var(--md-sys-color-surface-container)",
	};

	if (isLoading || !movie) {
		return (
			<div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
				<div
					className="w-full h-full animate-pulse"
					style={{
						background: `linear-gradient(135deg, var(--md-sys-color-surface-container) 0%, var(--md-sys-color-surface) 100%)`,
					}}
				/>
				<div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
					<div className="container mx-auto max-w-7xl">
						<div className="flex items-end gap-4 md:gap-8">
							<div className="shrink-0">
								<div className="w-28 md:w-48 lg:w-64 rounded-lg overflow-hidden bg-(--md-sys-color-surface-container)" />
							</div>
							<div className="flex-1 pb-2">
								<div className="h-8 md:h-16 lg:w-96 bg-(--md-sys-color-surface-container) rounded-lg animate-pulse" />
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
			{backdropUrl ? (
				<>
					<img
						src={backdropUrl}
						alt=""
						className="w-full h-full object-cover"
					/>
					<div
						className="absolute inset-0"
						style={{
							background: `linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--md-sys-color-surface) 60%, transparent) 60%, var(--md-sys-color-surface) 100%)`,
						}}
					/>
					<div
						className="absolute inset-0"
						style={{
							background: `linear-gradient(to right, color-mix(in srgb, var(--md-sys-color-surface) 80%, transparent) 0%, transparent 50%)`,
						}}
					/>
				</>
			) : (
				<div
					className="w-full h-full"
					style={{
						background: `linear-gradient(135deg, ${colors.muted} 0%, var(--md-sys-color-surface) 100%)`,
					}}
				/>
			)}

			<button
				type="button"
				onClick={() => router.history.back()}
				className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors cursor-pointer"
			>
				<ArrowLeft className="w-5 h-5" />
			</button>

			<div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
				<div className="container mx-auto max-w-7xl">
					<div className="flex items-end gap-4 md:gap-8">
						<div className="shrink-0">
							<div
								className="w-28 md:w-48 lg:w-64 rounded-lg overflow-hidden shadow-2xl"
								style={{
									boxShadow: `0 25px 50px -12px color-mix(in srgb, ${colors.primary} 25%, transparent)`,
								}}
							>
								{posterUrl ? (
									<img
										src={posterUrl}
										alt={movie?.title}
										className="w-full aspect-2/3 object-cover"
									/>
								) : (
									<div
										className="w-full aspect-2/3 flex items-center justify-center"
										style={{
											backgroundColor:
												"var(--md-sys-color-surface-container-high)",
											color: "var(--md-sys-color-on-surface-variant)",
										}}
									>
										No poster
									</div>
								)}
							</div>
						</div>

						<div className="flex-1 pb-2">
							<h1
								className="text-2xl md:text-5xl lg:text-6xl font-bold mb-2"
								style={{
									textShadow: `0 4px 30px color-mix(in srgb, ${colors.primary} 38%, transparent)`,
								}}
							>
								{movie?.title}
							</h1>
							{releaseYear && (
								<div
									className="flex items-center gap-4 text-lg"
									style={{ color: "var(--md-sys-color-on-surface-variant)" }}
								>
									<span className="flex items-center gap-2">
										<Calendar
											className="w-4 h-4"
											style={{ color: colors.accent }}
										/>
										{releaseYear}
									</span>
									{movie?.runtime && (
										<button
											type="button"
											onClick={() => setShowHours(!showHours)}
											className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
										>
											<Clock
												className="w-4 h-4"
												style={{ color: colors.accent }}
											/>
											{formatRuntime(movie.runtime, showHours)}
										</button>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
