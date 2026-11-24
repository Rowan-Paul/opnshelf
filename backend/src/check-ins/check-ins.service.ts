import { TID } from "@atproto/common";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { isAtprotoRecordMissingError } from "../common/atproto-record-errors";
import type { Prisma, WatchingCheckIn } from "../generated/client";
import { MoviesService } from "../movies/movies.service";
import { publicWatchOwner } from "../privacy/watch-access";
import { WatchPrivacyCoordinator } from "../privacy/watch-privacy-coordinator";
import { createWatchAgent, watchOperation } from "../privacy/watch-operation";
import { PrismaService } from "../prisma/prisma.service";
import { buildEpisodeWatchRecord } from "../shows/episode-watch-record";
import { ShowsService } from "../shows/shows.service";
import type { StartCheckInDto, WatchingCheckInDto } from "./check-ins.dto";

const selectOwner = { user: { select: { handle: true } } } as const;
type WithOwner = WatchingCheckIn & { user: { handle: string } };

function project(row: WithOwner): WatchingCheckInDto {
	return {
		rkey: row.rkey,
		userDid: row.userDid,
		handle: row.user.handle,
		mediaId: row.mediaId,
		title: row.title,
		seasonNumber: row.seasonNumber,
		episodeNumber: row.episodeNumber,
		startedAt: row.startedAt,
		endsAt: row.endsAt,
		finishing: !!row.finishingAt || (!!row.endsAt && row.endsAt <= new Date()),
	};
}

@Injectable()
export class CheckInsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(CheckInsService.name);
	private timer?: NodeJS.Timeout;
	private running = false;

	constructor(
		private readonly prisma: PrismaService,
		private readonly movies: MoviesService,
		private readonly shows: ShowsService,
		private readonly auth: AuthService,
		private readonly coordinator: WatchPrivacyCoordinator,
	) {}

	onModuleInit() {
		this.timer = setInterval(() => void this.finishDue(), 10_000).unref();
	}

	onModuleDestroy() {
		clearInterval(this.timer);
	}

	async own(userDid: string) {
		const row = await this.prisma.watchingCheckIn.findUnique({
			where: { userDid },
			include: selectOwner,
		});
		return { items: row ? [project(row)] : [] };
	}

	async visible(owner: Prisma.UserWhereInput) {
		const rows = await this.prisma.watchingCheckIn.findMany({
			where: {
				user: { ...owner, ...publicWatchOwner },
				finishingAt: null,
				OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
			},
			include: selectOwner,
			orderBy: { startedAt: "desc" },
		});
		return { items: rows.map(project) };
	}

	async start(userDid: string, dto: StartCheckInDto) {
		const { mediaId, seasonNumber, episodeNumber } = dto;
		if ((seasonNumber == null) !== (episodeNumber == null)) {
			throw new BadRequestException("Provide both season and episode numbers");
		}
		const { title, runtime } =
			seasonNumber != null && episodeNumber != null
				? await this.shows
						.getEpisodeDetails(mediaId, seasonNumber, episodeNumber)
						.then((episode) => ({
							title: episode.name,
							runtime: episode.runtime,
						}))
				: await this.movies.getMovieDetails(mediaId);
		return this.coordinator.write(userDid, async (_, signal) => {
			const existing = await this.prisma.watchingCheckIn.findUnique({
				where: { userDid },
			});
			const startedAt = new Date();
			if (
				existing &&
				(existing.rkey !== dto.replaceId ||
					existing.finishingAt ||
					(existing.endsAt && existing.endsAt <= startedAt))
			) {
				throw new ConflictException("Your check-in has changed");
			}
			signal.throwIfAborted();
			const data = {
				rkey: TID.nextStr(),
				mediaId,
				title,
				seasonNumber: seasonNumber ?? null,
				episodeNumber: episodeNumber ?? null,
				startedAt,
				endsAt:
					runtime && runtime > 0
						? new Date(startedAt.getTime() + runtime * 60_000)
						: null,
				finishingAt: null,
				retryAfter: null,
			};
			const row = await this.prisma.watchingCheckIn.upsert({
				where: { userDid },
				create: { userDid, ...data },
				update: data,
				include: selectOwner,
			});
			return project(row);
		});
	}

	async cancel(userDid: string, rkey: string) {
		await this.coordinator.write(userDid, async (_, signal) => {
			signal.throwIfAborted();
			await this.prisma.watchingCheckIn.deleteMany({
				where: {
					userDid,
					rkey,
					finishingAt: null,
					OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
				},
			});
		});
		return this.own(userDid);
	}

	async finish(userDid: string, rkey: string, session?: unknown) {
		await this.coordinator.write(
			userDid,
			(visibility, signal) =>
				watchOperation.run({ did: userDid, visibility, signal }, async () => {
					const row = await this.prisma.watchingCheckIn.findUnique({
						where: { userDid, rkey },
					});
					if (
						!row ||
						(!session && row.retryAfter && row.retryAfter > new Date())
					)
						return;
					const finishingAt = row.finishingAt ?? new Date();
					await this.prisma.watchingCheckIn.update({
						where: { userDid, rkey },
						data: { finishingAt, retryAfter: new Date(Date.now() + 60_000) },
					});
					const restored = session ?? (await this.auth.restore(userDid));
					if (
						!restored ||
						typeof restored !== "object" ||
						!("did" in restored) ||
						restored.did !== userDid
					) {
						throw new ConflictException("Sign in again to finish this Watch");
					}
					const agent = createWatchAgent(restored as { did: string });
					const repo = agent.com.atproto.repo;
					const { mediaId, seasonNumber, episodeNumber } = row;
					const start = row.startedAt.toISOString();
					const built =
						seasonNumber == null || episodeNumber == null
							? this.movies.buildMovieWatchRecord(mediaId, start, rkey)
							: buildEpisodeWatchRecord(
									mediaId,
									seasonNumber,
									episodeNumber,
									start,
									rkey,
								);
					const params = { repo: userDid, collection: built.collection, rkey };
					const {
						data: { uri, cid },
					} = await repo.getRecord(params).catch((error: unknown) => {
						if (!isAtprotoRecordMissingError(error)) throw error;
						return repo.putRecord({
							...params,
							record: { ...built.record, createdAt: finishingAt.toISOString() },
							validate: false,
						});
					});
					if (!cid) throw new Error("Completed Watch has no CID");
					if (seasonNumber == null || episodeNumber == null) {
						await this.movies.indexTrackedMovie(
							uri,
							cid,
							rkey,
							userDid,
							mediaId,
							start,
							true,
						);
					} else {
						await this.shows.indexTrackedEpisode(
							uri,
							cid,
							rkey,
							userDid,
							mediaId,
							seasonNumber,
							episodeNumber,
							start,
							true,
						);
					}
					signal.throwIfAborted();
					await this.prisma.watchingCheckIn.deleteMany({
						where: { userDid, rkey },
					});
				}),
			"watch.check-in.finish",
		);
		return this.own(userDid);
	}

	private async finishDue() {
		if (this.running) return;
		this.running = true;
		try {
			const now = new Date();
			const rows = await this.prisma.watchingCheckIn.findMany({
				where: {
					AND: [
						{ OR: [{ endsAt: { lte: now } }, { finishingAt: { not: null } }] },
						{ OR: [{ retryAfter: null }, { retryAfter: { lte: now } }] },
					],
				},
				orderBy: [
					{ retryAfter: { sort: "asc", nulls: "first" } },
					{ endsAt: "asc" },
				],
				take: 20,
				select: { userDid: true, rkey: true },
			});
			for (const { userDid, rkey } of rows) {
				try {
					await this.finish(userDid, rkey);
				} catch (error) {
					// Contention and an in-progress privacy migration can fail before
					// finish() claims the row. Back off so other due check-ins can run.
					await this.prisma.watchingCheckIn.updateMany({
						where: {
							userDid,
							rkey,
							OR: [{ retryAfter: null }, { retryAfter: { lte: now } }],
						},
						data: { retryAfter: new Date(Date.now() + 60_000) },
					});
					this.logger.warn(
						`Check-in completion will retry (${error instanceof Error ? error.name : "UnknownError"})`,
					);
				}
			}
		} catch (error) {
			this.logger.warn(error);
		} finally {
			this.running = false;
		}
	}
}
