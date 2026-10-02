import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MoviesTmdbService } from "../movies/movies-tmdb.service";
import { ShowsTmdbService, type TMDBShow } from "../shows/shows-tmdb.service";
import { ShowProgressService } from "../shows/show-progress.service";
import type {
	WatchPickerItemDto,
	WatchPickerQueryDto,
} from "./watch-picker.dto";

type EpisodePosition = { seasonNumber: number; episodeNumber: number };
type Candidate = { mediaType: "movie" | "show"; mediaId: string };
type PickerContext = {
	country: string;
	serviceIds: number[];
	budget: number;
	today: string;
	watchedShows: Set<string>;
	watchedEpisodes: Set<string>;
	next: Map<string, EpisodePosition>;
};
export function watchingBudget(minutes: number) {
	return Math.floor(minutes - Math.min(minutes * 0.1, 15));
}
const episodeKey = (showId: string, season: number, episode: number) =>
	`${showId}:${season}:${episode}`;

@Injectable()
export class WatchPickerService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly movies: MoviesTmdbService,
		private readonly shows: ShowsTmdbService,
		private readonly progress: ShowProgressService,
	) {}
	async get(userDid: string, query: WatchPickerQueryDto) {
		const [user, list, watches] = await Promise.all([
			this.prisma.user.findUniqueOrThrow({
				where: { did: userDid },
				select: { watchCountry: true },
			}),
			this.prisma.list.findFirst({
				where: { userDid, slug: "watchlist" },
				include: { items: true },
			}),
			this.prisma.trackedEpisode.findMany({
				where: { userDid, seasonNumber: { not: 0 } },
				select: { showId: true, seasonNumber: true, episodeNumber: true },
			}),
		]);
		const next = new Map<string, EpisodePosition>();
		// Load the complete queue once, without pagination or presentation work.
		for (const item of await this.progress.getUserUpNextPositions(userDid))
			next.set(item.showId, item.nextEpisode);
		const pool = new Map<string, Candidate>();
		for (const mediaId of next.keys())
			pool.set(`show:${mediaId}`, { mediaType: "show", mediaId });
		for (const item of list?.items ?? []) {
			if (item.mediaType === "movie" || item.mediaType === "show")
				pool.set(`${item.mediaType}:${item.mediaId}`, {
					mediaType: item.mediaType,
					mediaId: item.mediaId,
				});
		}
		const context: PickerContext = {
			country: user.watchCountry ?? "US",
			serviceIds: query.services?.split(",").map(Number) ?? [],
			budget: watchingBudget(query.minutes),
			today: new Date().toISOString().slice(0, 10),
			watchedShows: new Set(watches.map((w) => w.showId)),
			watchedEpisodes: new Set(
				watches.map((w) =>
					episodeKey(w.showId, w.seasonNumber, w.episodeNumber),
				),
			),
			next,
		};
		const genres = new Set<string>();
		const items: WatchPickerItemDto[] = [];
		const candidates = [...pool.values()];
		// Bound fan-out rather than sending a user's entire watchlist to TMDB at once.
		for (let offset = 0; offset < candidates.length; offset += 6) {
			const batch = await Promise.all(
				candidates
					.slice(offset, offset + 6)
					.map((candidate) => this.session(candidate, query, context, genres)),
			);
			items.push(
				...batch.filter((item): item is WatchPickerItemDto => item !== null),
			);
		}
		return { items, genres: [...genres].sort() };
	}
	private async session(
		candidate: Candidate,
		query: WatchPickerQueryDto,
		context: PickerContext,
		genres: Set<string>,
	): Promise<WatchPickerItemDto | null> {
		const { mediaType, mediaId } = candidate;
		if (query.type && query.type !== "both" && query.type !== mediaType)
			return null;
		const continuing =
			mediaType === "show" && context.watchedShows.has(mediaId);
		if (
			(query.progress === "continue" && !continuing) ||
			(query.progress === "start" && continuing)
		)
			return null;
		if (continuing && !context.next.has(mediaId)) return null;
		const detail =
			mediaType === "movie"
				? await this.movies.getMovieDetails(mediaId)
				: await this.shows.getShowDetails(mediaId);
		for (const genre of detail.genres ?? []) genres.add(genre.name);
		if (query.genre && !detail.genres?.some((g) => g.name === query.genre))
			return null;
		const result: WatchPickerItemDto = {
			id: `${mediaType}:${mediaId}`,
			mediaType,
			mediaId,
			title: "title" in detail ? detail.title : detail.name,
			posterPath: detail.poster_path,
			estimated: false,
			minutes: 0,
			episodes: [],
			services: [],
		};
		if ("title" in detail) {
			if (
				!detail.runtime ||
				detail.runtime <= 0 ||
				detail.runtime > context.budget ||
				!detail.release_date ||
				detail.release_date > context.today
			)
				return null;
			const availability = (await this.movies.getWatchProviders(mediaId))
				?.results[context.country];
			const services = availability?.flatrate ?? [];
			if (
				context.serviceIds.length &&
				!services.some((s) => context.serviceIds.includes(s.provider_id))
			)
				return null;
			return {
				...result,
				minutes: detail.runtime,
				services: services.filter(
					(s) =>
						!context.serviceIds.length ||
						context.serviceIds.includes(s.provider_id),
				),
				watchLink: availability?.link,
			};
		}
		return this.showSession(result, detail, context);
	}
	private async showSession(
		result: WatchPickerItemDto,
		detail: TMDBShow,
		context: PickerContext,
	): Promise<WatchPickerItemDto | null> {
		const start = context.next.get(result.mediaId);
		const fallback = detail.episode_run_time?.find((n) => n > 0);
		const finish = () => (result.episodes.length ? result : null);
		for (const season of [...(detail.seasons ?? [])].sort(
			(a, b) => a.season_number - b.season_number,
		)) {
			if (
				season.season_number === 0 ||
				(start && season.season_number < start.seasonNumber)
			)
				continue;
			const [data, availabilityResponse] = await Promise.all([
				this.shows.getSeasonDetails(result.mediaId, season.season_number),
				this.shows.getUpNextAvailability(result.mediaId, season.season_number),
			]);
			const availability = availabilityResponse.results[context.country];
			const services = (availability?.flatrate ?? []).filter(
				(s) =>
					!context.serviceIds.length ||
					context.serviceIds.includes(s.provider_id),
			);
			if (context.serviceIds.length && !services.length) return finish();
			const knownRuntimes = data.episodes
				.flatMap((e) => (e.runtime && e.runtime > 0 ? [e.runtime] : []))
				.sort((a, b) => a - b);
			const estimate =
				fallback ?? knownRuntimes[Math.floor(knownRuntimes.length / 2)];
			for (const episode of [...data.episodes].sort(
				(a, b) => a.episode_number - b.episode_number,
			)) {
				if (
					start &&
					season.season_number === start.seasonNumber &&
					episode.episode_number < start.episodeNumber
				)
					continue;
				if (
					!episode.air_date ||
					episode.air_date > context.today ||
					context.watchedEpisodes.has(
						episodeKey(
							result.mediaId,
							season.season_number,
							episode.episode_number,
						),
					)
				)
					return finish();
				const runtime =
					episode.runtime && episode.runtime > 0 ? episode.runtime : estimate;
				if (!runtime || result.minutes + runtime > context.budget)
					return finish();
				result.minutes += runtime;
				result.estimated ||= !episode.runtime || episode.runtime <= 0;
				result.episodes.push({
					seasonNumber: season.season_number,
					episodeNumber: episode.episode_number,
					name: episode.name,
					serviceIds: services.map((s) => s.provider_id),
				});
				for (const service of services)
					if (
						!result.services.some((s) => s.provider_id === service.provider_id)
					)
						result.services.push(service);
				result.watchLink ??= availability?.link;
			}
		}
		return finish();
	}
}
