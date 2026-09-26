import {
	collectionItems,
	notificationEmail,
	releaseTeaser,
} from "./notification-content";
import type { NotificationCollectionItemDto } from "./notifications.dto";
import { sendPushNotification } from "./send-push";
import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { BackendEnv } from "../config/env.schema";
import slugify from "slugify";
import { EmailService } from "../email/email.service";
import { MoviesTmdbService } from "../movies/movies-tmdb.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsTmdbService } from "../shows/shows-tmdb.service";

const HOUR_MS = 3_600_000;
const MAX_ATTEMPTS = 5;
type Event = {
	key: string;
	title: string;
	body: string;
	path?: string;
	collectionId?: string;
	collection?: {
		heading: string;
		periodStart: string;
		periodEnd: string;
		items: NotificationCollectionItemDto[];
	};
};
type Category = "NewReleases" | "WatchlistReleases" | "NewSeasons" | "Stats";

function localParts(now: Date, timezone: string) {
	try {
		const parts = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			hourCycle: "h23",
			weekday: "short",
		}).formatToParts(now);
		const value = (type: string) =>
			parts.find((part) => part.type === type)?.value ?? "";
		return {
			date: `${value("year")}-${value("month")}-${value("day")}`,
			hour: Number(value("hour")),
			weekday: value("weekday"),
			day: Number(value("day")),
			month: Number(value("month")),
		};
	} catch {
		return localParts(now, "UTC");
	}
}

function mediaPath(
	kind: "movies" | "shows",
	id: string,
	title: string,
): string {
	return `/${kind}/${id}/${slugify(title, { lower: true, strict: true }) || "title"}`;
}

function addDays(date: string, days: number): string {
	const value = new Date(`${date}T00:00:00.000Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

function localMidnightUtc(date: string, timezone: string): Date {
	return localTimeUtc(date, timezone, 0);
}

function localTimeUtc(date: string, timezone: string, hour: number): Date {
	try {
		new Intl.DateTimeFormat("en", { timeZone: timezone });
	} catch {
		timezone = "UTC";
	}
	const [year, month, day] = date.split("-").map(Number);
	const target = Date.UTC(year, month - 1, day, hour);
	let instant = target;
	for (let attempt = 0; attempt < 2; attempt++) {
		const parts = new Intl.DateTimeFormat("en-GB", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		}).formatToParts(instant);
		const part = (type: string) =>
			Number(parts.find((item) => item.type === type)?.value ?? 0);
		const seen = Date.UTC(
			part("year"),
			part("month") - 1,
			part("day"),
			part("hour"),
			part("minute"),
		);
		instant += target - seen;
	}
	return new Date(instant);
}

@Injectable()
export class NotificationWorkerService
	implements OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(NotificationWorkerService.name);
	private timer: NodeJS.Timeout | null = null;
	private busy = false;
	private schedulesReconciled = false;

	constructor(
		private readonly prisma: PrismaService,
		private readonly email: EmailService,
		private readonly config: BackendEnv,
		private readonly movies: MoviesTmdbService,
		private readonly shows: ShowsTmdbService,
	) {}

	onModuleInit(): void {
		this.timer = setInterval(() => void this.tick(), 5 * 60_000);
		void this.tick();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}

	private async tick(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			if (!this.schedulesReconciled) {
				// nextQueueAt caches the previous process's scheduling rules. A
				// deployment can introduce an earlier slot (e.g. Friday evening).
				// Recheck future schedules once on startup; existing event keys
				// preserve deliveries already queued or sent. Failed resets retry.
				const now = new Date();
				await this.prisma.notificationSettings.updateMany({
					where: { nextQueueAt: { gt: now } },
					data: { nextQueueAt: now },
				});
				this.schedulesReconciled = true;
			}
			await this.refreshRelevantCatalog();
			await this.queueDueEvents(new Date());
			await this.deliverPending();
		} catch (error) {
			this.logger.error(
				`Notification worker failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			this.busy = false;
		}
	}

	/** Refresh watchlist dates and followed-show season summaries from TMDB. */
	private async refreshRelevantCatalog(): Promise<void> {
		const stale = new Date(Date.now() - 24 * HOUR_MS);
		const [movies, shows] = await Promise.all([
			this.prisma.movie.findMany({
				where: {
					updatedAt: { lt: stale },
					listItems: { some: { list: { slug: "watchlist" } } },
				},
				orderBy: { updatedAt: "asc" },
				take: 25,
			}),
			this.prisma.show.findMany({
				where: {
					updatedAt: { lt: stale },
					OR: [
						{ listItems: { some: { list: { slug: "watchlist" } } } },
						{ trackedBy: { some: {} } },
					],
				},
				orderBy: { updatedAt: "asc" },
				take: 25,
			}),
		]);
		for (const movie of movies) {
			try {
				const detail = await this.movies.getMovieDetails(movie.movieId);
				await this.prisma.movie.update({
					where: { movieId: movie.movieId },
					data: {
						title: detail.title,
						releaseDate: detail.release_date
							? new Date(detail.release_date)
							: null,
						releaseYear: detail.release_date
							? Number(detail.release_date.slice(0, 4))
							: null,
					},
				});
			} catch (error) {
				this.logger.warn(
					`Could not refresh movie ${movie.movieId}: ${String(error)}`,
				);
				await this.prisma.movie.update({
					where: { movieId: movie.movieId },
					data: { updatedAt: new Date() },
				});
			}
		}
		for (const show of shows) {
			try {
				const detail = await this.shows.getShowDetails(show.showId);
				await this.prisma.show.update({
					where: { showId: show.showId },
					data: {
						title: detail.name,
						firstAirDate: detail.first_air_date
							? new Date(detail.first_air_date)
							: null,
						firstAirYear: detail.first_air_date
							? Number(detail.first_air_date.slice(0, 4))
							: null,
					},
				});
				for (const season of detail.seasons ?? []) {
					if (season.season_number <= 0) continue;
					await this.prisma.season.upsert({
						where: {
							showId_seasonNumber: {
								showId: show.showId,
								seasonNumber: season.season_number,
							},
						},
						create: {
							showId: show.showId,
							tmdbId: season.id,
							seasonNumber: season.season_number,
							name: season.name,
							airDate: season.air_date ? new Date(season.air_date) : null,
							episodeCount: season.episode_count ?? null,
							posterPath: season.poster_path ?? null,
						},
						update: {
							name: season.name,
							airDate: season.air_date ? new Date(season.air_date) : null,
							episodeCount: season.episode_count ?? null,
							posterPath: season.poster_path ?? null,
						},
					});
				}
			} catch (error) {
				this.logger.warn(
					`Could not refresh show ${show.showId}: ${String(error)}`,
				);
				await this.prisma.show.update({
					where: { showId: show.showId },
					data: { updatedAt: new Date() },
				});
			}
		}
	}

	/** Runs in bounded pages, so adding accounts does not grow one DB read forever. */
	async queueDueEvents(now: Date): Promise<void> {
		let cursor: string | undefined;
		const globalReleases = new Map<string, Event | null>();
		do {
			const rows = await this.prisma.notificationSettings.findMany({
				where: { nextQueueAt: { lte: now } },
				take: 100,
				...(cursor && { skip: 1, cursor: { userDid: cursor } }),
				orderBy: { userDid: "asc" },
				include: {
					user: {
						select: { timezone: true, watchCountry: true, handle: true },
					},
				},
			});
			for (const row of rows) {
				try {
					await this.queueUserEvents(row, now, globalReleases);
					const day = localParts(now, row.user.timezone);
					await this.prisma.notificationSettings.updateMany({
						where: { userDid: row.userDid, nextQueueAt: row.nextQueueAt },
						data: {
							nextQueueAt: localTimeUtc(
								day.hour < 9 || (day.weekday === "Fri" && day.hour < 18)
									? day.date
									: addDays(day.date, 1),
								row.user.timezone,
								day.weekday === "Fri" && day.hour >= 9 && day.hour < 18
									? 18
									: 9,
							),
						},
					});
				} catch (error) {
					this.logger.warn(
						`Could not queue notifications for ${row.userDid}: ${String(error)}`,
					);
				}
			}
			cursor = rows.length === 100 ? rows.at(-1)?.userDid : undefined;
		} while (cursor);
	}

	private async queueUserEvents(
		row: Awaited<
			ReturnType<typeof this.prisma.notificationSettings.findMany>
		>[number] & {
			user: { timezone: string; watchCountry: string; handle: string };
		},
		now: Date,
		globalReleases: Map<string, Event | null>,
	): Promise<void> {
		const day = localParts(now, row.user.timezone);
		if (day.hour < 9) return;
		const devices = await this.prisma.pushDevice.findMany({
			where: { userDid: row.userDid },
		});
		if ((!row.email || !row.emailVerifiedAt) && devices.length === 0) return;
		const events: Array<[Category, Event | null]> = [];
		if (
			day.weekday === "Fri" &&
			day.hour >= 18 &&
			(row.emailNewReleases || (devices.length && row.pushNewReleases))
		) {
			// Friday recommendations cover this week, including the coming weekend.
			const start = addDays(day.date, -4);
			const cacheKey = `${start}:${row.user.watchCountry}`;
			if (!globalReleases.has(cacheKey)) {
				globalReleases.set(
					cacheKey,
					await this.globalReleases(
						start,
						addDays(day.date, 2),
						row.user.watchCountry,
					),
				);
			}
			events.push(["NewReleases", globalReleases.get(cacheKey) ?? null]);
		}
		if (
			row.emailWatchlistReleases ||
			(devices.length && row.pushWatchlistReleases)
		) {
			events.push([
				"WatchlistReleases",
				await this.watchlistReleases(row.userDid, day.date),
			]);
		}
		if (row.emailNewSeasons || (devices.length && row.pushNewSeasons)) {
			events.push(["NewSeasons", await this.newSeasons(row.userDid, day.date)]);
		}
		if (row.emailStats || (devices.length && row.pushStats)) {
			events.push(
				...(await this.statsEvents(row.userDid, day, row.user.timezone)),
			);
		}
		for (const [category, candidate] of events) {
			if (!candidate) continue;
			let event = candidate;
			if (candidate.collection) {
				const saved = await this.prisma.notificationCollection.upsert({
					where: {
						userDid_eventKey: { userDid: row.userDid, eventKey: candidate.key },
					},
					create: {
						userDid: row.userDid,
						eventKey: candidate.key,
						title: candidate.title,
						body: candidate.body,
						...candidate.collection,
						items: candidate.collection.items.map((item) => ({ ...item })),
					},
					update: {},
				});
				const items = collectionItems(saved.items);
				event = {
					...candidate,
					title: saved.title,
					body: saved.body,
					collectionId: saved.id,
					path:
						category === "NewReleases" || items.length > 1
							? `/discover/collections/${saved.id}`
							: items[0].path,
				};
			}
			const emailEnabled = row[`email${category}`];
			const pushEnabled = row[`push${category}`];
			if (emailEnabled && row.email && row.emailVerifiedAt) {
				await this.enqueue(row.userDid, "email", category, event);
			}
			if (pushEnabled) {
				for (const device of devices)
					await this.enqueue(
						row.userDid,
						`push:${device.token}`,
						category,
						event,
					);
			}
		}
	}

	private async globalReleases(
		start: string,
		end: string,
		region: string,
	): Promise<Event | null> {
		try {
			const [movies, shows] = await Promise.all([
				this.movies.discoverReleasesBetween(start, end, region),
				this.shows.discoverPremieresBetween(start, end),
			]);
			const items: NotificationCollectionItemDto[] = [
				...movies.slice(0, 3).map((movie) => ({
					mediaId: String(movie.id),
					mediaType: "movie" as const,
					title: movie.title,
					posterPath: movie.poster_path || null,
					overview: movie.overview || "",
					releaseDate: movie.release_date || null,
					seasonNumber: null,
					path: mediaPath("movies", String(movie.id), movie.title),
				})),
				...shows.slice(0, 3).map((show) => ({
					mediaId: String(show.id),
					mediaType: "show" as const,
					title: show.name,
					posterPath: show.poster_path || null,
					overview: show.overview || "",
					releaseDate: show.first_air_date || null,
					seasonNumber: null,
					path: mediaPath("shows", String(show.id), show.name),
				})),
			];
			if (!items.length) return null;
			return {
				key: `new-releases:${start}:${region}`,
				title: "Your weekend watch starts here",
				body: releaseTeaser(items),
				collection: {
					heading: "This week’s releases",
					periodStart: start,
					periodEnd: end,
					items,
				},
			};
		} catch (error) {
			this.logger.warn(
				`Release discovery failed for ${start}/${region}: ${String(error)}`,
			);
			throw error;
		}
	}

	private async watchlistReleases(
		did: string,
		date: string,
	): Promise<Event | null> {
		const start = new Date(`${date}T00:00:00.000Z`);
		const end = new Date(start.getTime() + 24 * HOUR_MS);
		const items = await this.prisma.listItem.findMany({
			where: {
				userDid: did,
				list: { slug: "watchlist" },
				OR: [
					{ movie: { releaseDate: { gte: start, lt: end } } },
					{ show: { firstAirDate: { gte: start, lt: end } } },
				],
			},
			include: { movie: true, show: true },
			take: 20,
		});
		if (!items.length) return null;
		const selection: NotificationCollectionItemDto[] = items.flatMap((item) => {
			const media = item.movie ?? item.show;
			if (!media) return [];
			const mediaType = item.movie ? ("movie" as const) : ("show" as const);
			const id = item.movie?.movieId ?? item.show?.showId;
			if (!id) return [];
			return [
				{
					mediaId: id,
					mediaType,
					title: media.title,
					posterPath: media.posterPath,
					overview: media.overview ?? "",
					releaseDate: date,
					seasonNumber: null,
					path: mediaPath(item.movie ? "movies" : "shows", id, media.title),
				},
			];
		});
		// A title can be represented by more than one season/episode in a Watchlist.
		const unique = selection.filter(
			(item, index) =>
				selection.findIndex((other) => other.path === item.path) === index,
		);
		if (!unique.length) return null;
		return {
			key: `watchlist:${date}`,
			title:
				unique.length === 1
					? "One from your Watchlist releases today"
					: `${unique.length} from your Watchlist release today`,
			body: releaseTeaser(unique),
			collection: {
				heading: "Your Watchlist releases",
				periodStart: date,
				periodEnd: date,
				items: unique,
			},
		};
	}

	private async newSeasons(did: string, date: string): Promise<Event | null> {
		const [items, watches] = await Promise.all([
			this.prisma.listItem.findMany({
				where: {
					userDid: did,
					list: { slug: "watchlist" },
					showId: { not: null },
				},
				select: { showId: true },
			}),
			this.prisma.trackedEpisode.findMany({
				where: { userDid: did },
				distinct: ["showId"],
				select: { showId: true },
			}),
		]);
		const showIds = [
			...new Set(
				[
					...items.map((item) => item.showId),
					...watches.map((watch) => watch.showId),
				].filter((id): id is string => !!id),
			),
		];
		if (!showIds.length) return null;
		const start = new Date(`${date}T00:00:00.000Z`);
		const seasons = await this.prisma.season.findMany({
			where: {
				showId: { in: showIds },
				seasonNumber: { gt: 1 },
				airDate: { gte: start, lt: new Date(start.getTime() + 24 * HOUR_MS) },
			},
			include: { show: true },
			take: 20,
		});
		if (!seasons.length) return null;
		const selection: NotificationCollectionItemDto[] = seasons.map(
			(season) => ({
				mediaId: season.showId,
				mediaType: "show",
				title: season.show.title,
				posterPath: season.posterPath ?? season.show.posterPath,
				overview: season.show.overview ?? "",
				releaseDate: date,
				seasonNumber: season.seasonNumber,
				path: `${mediaPath("shows", season.showId, season.show.title)}/seasons/${season.seasonNumber}`,
			}),
		);
		return {
			key: `new-seasons:${date}`,
			title:
				selection.length === 1
					? "A show you follow is back"
					: `${selection.length} shows you follow are back`,
			body: releaseTeaser(selection),
			collection: {
				heading: "New seasons to catch up on",
				periodStart: date,
				periodEnd: date,
				items: selection,
			},
		};
	}

	private async statsEvents(
		did: string,
		day: ReturnType<typeof localParts>,
		timezone: string,
	): Promise<Array<[Category, Event]>> {
		const events: Array<[Category, Event]> = [];
		const today = new Date(`${day.date}T00:00:00.000Z`);
		const periods: Array<{ name: string; due: boolean; start: string }> = [
			{
				name: "weekly",
				due: day.weekday === "Mon",
				start: addDays(day.date, -7),
			},
			{
				name: "monthly",
				due: day.day === 1,
				start: new Date(
					Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
				)
					.toISOString()
					.slice(0, 10),
			},
			{
				name: "yearly",
				due: day.day === 1 && day.month === 1,
				start: new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1))
					.toISOString()
					.slice(0, 10),
			},
		];
		for (const period of periods) {
			if (!period.due) continue;
			const start = localMidnightUtc(period.start, timezone);
			const end = localMidnightUtc(day.date, timezone);
			const [movies, episodes] = await Promise.all([
				this.prisma.trackedMovie.count({
					where: {
						userDid: did,
						status: "watched",
						watchedDate: { gte: start, lt: end },
					},
				}),
				this.prisma.trackedEpisode.count({
					where: {
						userDid: did,
						status: "watched",
						watchedDate: { gte: start, lt: end },
					},
				}),
			]);
			events.push([
				"Stats",
				{
					key: `stats:${period.name}:${day.date}`,
					title: `Your ${period.name} watch stats`,
					body: `You watched ${movies} movies and ${episodes} episodes.`,
					path: "/",
				},
			]);
		}
		return events;
	}

	private async enqueue(
		did: string,
		channel: string,
		category: Category,
		event: Event,
	): Promise<void> {
		await this.prisma.notificationDelivery.upsert({
			where: {
				userDid_channel_eventKey: {
					userDid: did,
					channel,
					eventKey: event.key,
				},
			},
			create: {
				userDid: did,
				channel,
				category,
				eventKey: event.key,
				title: event.title,
				body: event.body,
				url: event.path,
				collectionId: event.collectionId,
			},
			update: {},
		});
	}

	async deliverPending(): Promise<void> {
		const now = new Date();
		const jobs = await this.prisma.notificationDelivery.findMany({
			where: {
				status: { in: ["pending", "sending"] },
				nextAttemptAt: { lte: now },
			},
			orderBy: { nextAttemptAt: "asc" },
			take: 50,
			include: {
				user: { select: { notificationSettings: true } },
				collection: true,
			},
		});
		for (const job of jobs) {
			const claimed = await this.prisma.notificationDelivery.updateMany({
				where: {
					id: job.id,
					status: job.status,
					nextAttemptAt: job.nextAttemptAt,
				},
				data: {
					status: "sending",
					attempts: { increment: 1 },
					nextAttemptAt: new Date(Date.now() + 15 * 60_000),
				},
			});
			if (!claimed.count) continue;
			try {
				if (job.channel === "email") {
					const settings = job.user.notificationSettings;
					const enabled = settings?.[`email${job.category as Category}`];
					if (enabled && settings.email && settings.emailVerifiedAt) {
						await this.email.sendNotification({
							to: settings.email,
							subject: job.title,
							...notificationEmail({
								title: job.title,
								body: job.body,
								url: job.url,
								collection: job.collection,
								baseUrl: this.config.FRONTEND_URL || "https://opnshelf.xyz",
							}),
						});
					}
				} else if (job.channel.startsWith("push:")) {
					const token = job.channel.slice(5);
					const device = await this.prisma.pushDevice.findUnique({
						where: { token },
					});
					const enabled =
						job.user.notificationSettings?.[`push${job.category as Category}`];
					if (enabled && device?.userDid === job.userDid)
						await sendPushNotification(this.prisma, token, job);
				}
				await this.prisma.notificationDelivery.update({
					where: { id: job.id },
					data: { status: "sent", sentAt: new Date() },
				});
			} catch (error) {
				const attempts = job.attempts + 1;
				await this.prisma.notificationDelivery.update({
					where: { id: job.id },
					data: {
						status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
						nextAttemptAt: new Date(
							Date.now() + Math.min(2 ** attempts, 24) * HOUR_MS,
						),
					},
				});
				this.logger.warn(`Notification ${job.id} failed: ${String(error)}`);
			}
		}
	}
}
