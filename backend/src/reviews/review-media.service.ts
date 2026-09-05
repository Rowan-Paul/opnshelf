import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Display label and slug source for the media a Review points at.
 *
 * `title` is what a human reads and is composite for a season or episode
 * ("Breaking Bad — S1E1: Pilot"). `mediaTitle` is the title of the movie or
 * show that `mediaId` identifies, never composite, because it is what URL slugs
 * are built from — web slugs an episode URL from the show name alone, so
 * slugging the composite would produce a different URL for the same page
 * (ADR 0023).
 */
export type MediaLabel = {
	/** Composite for a season or episode: "Breaking Bad — S1E1: Pilot". */
	label: string;
	/** Title of the movie or show `mediaId` identifies. Never composite. */
	mediaTitle: string;
	posterPath: string | null;
};

export type ReviewMediaCoordinates = {
	id: string;
	mediaType: string;
	mediaId: string;
	seasonNumber: number;
	episodeNumber: number;
};

/**
 * Resolves the locally-indexed Movie/Show/Season/Episode a Review points at.
 * Shared by the API read paths, the Blog Mirror and the Bluesky Cross-post.
 */
@Injectable()
export class ReviewMediaService {
	constructor(private prisma: PrismaService) {}

	/**
	 * Resolve `{ title, posterPath }` for each review's media item by joining the
	 * locally-indexed Movie/Show/Season/Episode tables. The cover is always the
	 * underlying media poster — a Review carries no cover of its own.
	 *
	 * Returned as a Map keyed by review id.
	 */
	async enrichMediaForReviews(
		reviews: ReviewMediaCoordinates[],
	): Promise<Map<string, MediaLabel>> {
		const movieIds = reviews
			.filter((r) => r.mediaType === "movie")
			.map((r) => r.mediaId);
		const showIds = reviews
			.filter((r) => r.mediaType === "show")
			.map((r) => r.mediaId);
		const seasonConditions = reviews
			.filter((r) => r.mediaType === "season")
			.map((r) => ({ showId: r.mediaId, seasonNumber: r.seasonNumber }));
		const episodeConditions = reviews
			.filter((r) => r.mediaType === "episode")
			.map((r) => ({
				showId: r.mediaId,
				seasonNumber: r.seasonNumber,
				episodeNumber: r.episodeNumber,
			}));

		const [movies, shows, seasons, episodes] = await Promise.all([
			movieIds.length > 0
				? this.prisma.movie.findMany({
						where: { movieId: { in: movieIds } },
					})
				: Promise.resolve([]),
			showIds.length > 0
				? this.prisma.show.findMany({
						where: { showId: { in: showIds } },
					})
				: Promise.resolve([]),
			seasonConditions.length > 0
				? this.prisma.season.findMany({
						where: { OR: seasonConditions },
						include: { show: true },
					})
				: Promise.resolve([]),
			episodeConditions.length > 0
				? this.prisma.episode.findMany({
						where: { OR: episodeConditions },
						include: { season: { include: { show: true } } },
					})
				: Promise.resolve([]),
		]);

		const movieMap = new Map<string, MediaLabel>();
		for (const m of movies) {
			movieMap.set(m.movieId, {
				label: m.title,
				mediaTitle: m.title,
				posterPath: m.posterPath,
			});
		}
		const showMap = new Map<string, MediaLabel>();
		for (const s of shows) {
			showMap.set(s.showId, {
				label: s.title,
				mediaTitle: s.title,
				posterPath: s.posterPath,
			});
		}
		const seasonMap = new Map<string, MediaLabel>();
		for (const s of seasons) {
			const key = `${s.showId}:${s.seasonNumber}`;
			seasonMap.set(key, {
				label: `${s.show.title} — ${s.name}`,
				mediaTitle: s.show.title,
				posterPath: s.posterPath ?? s.show.posterPath,
			});
		}
		const episodeMap = new Map<string, MediaLabel>();
		for (const e of episodes) {
			const key = `${e.showId}:${e.seasonNumber}:${e.episodeNumber}`;
			episodeMap.set(key, {
				label: `${e.season.show.title} — S${e.seasonNumber}E${e.episodeNumber}: ${e.name}`,
				mediaTitle: e.season.show.title,
				// Cover is always the portrait media poster, never the landscape
				// episode still — fall back season → show.
				posterPath: e.season.posterPath ?? e.season.show.posterPath,
			});
		}

		const byReviewId = new Map<string, MediaLabel>();
		for (const review of reviews) {
			let media: MediaLabel | undefined;
			if (review.mediaType === "movie") {
				media = movieMap.get(review.mediaId);
			} else if (review.mediaType === "show") {
				media = showMap.get(review.mediaId);
			} else if (review.mediaType === "season") {
				media = seasonMap.get(`${review.mediaId}:${review.seasonNumber}`);
			} else if (review.mediaType === "episode") {
				media = episodeMap.get(
					`${review.mediaId}:${review.seasonNumber}:${review.episodeNumber}`,
				);
			}
			if (media) {
				byReviewId.set(review.id, media);
			}
		}

		return byReviewId;
	}
}
