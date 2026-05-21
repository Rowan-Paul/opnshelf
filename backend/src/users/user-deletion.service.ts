import { Agent } from "@atproto/api";
import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { $nsid as EPISODE_COLLECTION } from "../lexicons/xyz/opnshelf/episode";
import { $nsid as FOLLOW_COLLECTION } from "../lexicons/xyz/opnshelf/follow";
import { $nsid as LIST_COLLECTION } from "../lexicons/xyz/opnshelf/list";
import { $nsid as LIST_ITEM_COLLECTION } from "../lexicons/xyz/opnshelf/list/item";
import { $nsid as MOVIE_COLLECTION } from "../lexicons/xyz/opnshelf/movie";
import { $nsid as NOTE_COLLECTION } from "../lexicons/xyz/opnshelf/note";
import { $nsid as PROFILE_COLLECTION } from "../lexicons/xyz/opnshelf/profile.defs";
import { $nsid as REVIEW_COLLECTION } from "../lexicons/xyz/opnshelf/review";
import { PrismaService } from "../prisma/prisma.service";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import {
	ACCOUNT_DELETION_JOB_TYPE,
	buildAccountDeletionData,
	parseAccountDeletionData,
	type AccountDeletionJobData,
} from "./background-job-data";

interface ATSession {
	did: string;
}

const RECORDS_PAGE_SIZE = 100;
const ACTIVE_DELETION_STATUSES = ["queued", "running"];

@Injectable()
export class UserDeletionService {
	private readonly logger = new Logger(UserDeletionService.name);

	constructor(
		private readonly prisma: PrismaService,
		@Inject(AUTH_SERVICE)
		private readonly authService: Pick<AuthService, "restore">,
	) {}

	async deleteUserSync(did: string): Promise<void> {
		const user = await this.prisma.user.findUnique({
			where: { did },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		await this.prisma.user.delete({
			where: { did },
		});
	}

	async createDeletionJob(did: string, deletePdsData: boolean) {
		const user = await this.prisma.user.findUnique({
			where: { did },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const existingJob = await this.prisma.backgroundJob.findFirst({
			where: {
				type: ACCOUNT_DELETION_JOB_TYPE,
				userDid: did,
				status: { in: ACTIVE_DELETION_STATUSES },
			},
		});

		if (existingJob) {
			throw new ConflictException("An account deletion is already in progress");
		}

		const [movieCount, episodeCount, followCount, noteCount, reviewCount] =
			await Promise.all([
				this.prisma.trackedMovie.count({ where: { userDid: did } }),
				this.prisma.trackedEpisode.count({ where: { userDid: did } }),
				this.prisma.follow.count({
					where: { followerDid: did, rkey: { not: null } },
				}),
				this.prisma.note.count({ where: { userDid: did } }),
				this.prisma.review.count({ where: { userDid: did } }),
			]);

		// +1 for profile record, list items and lists are counted dynamically
		const totalRecords =
			movieCount + episodeCount + followCount + noteCount + reviewCount + 1;

		return this.prisma.backgroundJob.create({
			data: {
				type: ACCOUNT_DELETION_JOB_TYPE,
				userDid: did,
				status: "queued",
				data: buildAccountDeletionData({
					deletePdsData,
					totalRecords,
				}),
			},
		});
	}

	async getCurrentDeletionJob(userDid: string) {
		return this.prisma.backgroundJob.findFirst({
			where: {
				type: ACCOUNT_DELETION_JOB_TYPE,
				userDid,
			},
			orderBy: [{ createdAt: "desc" }],
		});
	}

	async processNextDeletionJob(): Promise<void> {
		const job = await this.prisma.backgroundJob.findFirst({
			where: {
				type: ACCOUNT_DELETION_JOB_TYPE,
				status: { in: ACTIVE_DELETION_STATUSES },
				nextRunAt: { lte: new Date() },
			},
			orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
		});

		if (!job) {
			return;
		}

		await this.processDeletionJob(job.id);
	}

	private async processDeletionJob(jobId: string): Promise<void> {
		const job = await this.prisma.backgroundJob.findUnique({
			where: { id: jobId },
		});
		if (!job || job.status === "completed" || job.status === "failed") {
			return;
		}

		const jobData = parseAccountDeletionData(job.data);

		await this.prisma.backgroundJob.update({
			where: { id: job.id },
			data: {
				status: "running",
				startedAt: job.startedAt ?? new Date(),
				lastError: null,
			},
		});

		try {
			if (jobData.deletePdsData) {
				await this.deletePdsRecordsWithProgress(job.id, job.userDid, jobData);
			}

			await this.updateJobData(job.id, jobData, { currentStep: "db_cleanup" });

			await this.prisma.user.delete({ where: { did: job.userDid } });

			await this.prisma.backgroundJob.update({
				where: { id: job.id },
				data: {
					status: "completed",
					completedAt: new Date(),
					data: { ...jobData, currentStep: "completed" },
				},
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(
				`Account deletion job ${job.id} failed: ${message}`,
				error instanceof Error ? error.stack : undefined,
			);
			await this.prisma.backgroundJob.update({
				where: { id: job.id },
				data: {
					status: "failed",
					lastError: message,
					completedAt: new Date(),
				},
			});
		}
	}

	private async deletePdsRecordsWithProgress(
		jobId: string,
		userDid: string,
		jobData: AccountDeletionJobData,
	): Promise<void> {
		const session = await this.restoreSession(userDid);
		if (!session) {
			throw new Error(
				"Your sign-in session expired. Could not delete PDS data.",
			);
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		await this.updateJobData(jobId, jobData, { currentStep: "movies" });
		const trackedMovies = await this.prisma.trackedMovie.findMany({
			where: { userDid },
		});
		for (const tracked of trackedMovies) {
			await this.tryDeleteRecord(
				agent,
				session.did,
				MOVIE_COLLECTION,
				tracked.rkey,
				`Failed to delete movie record ${tracked.rkey} from PDS`,
			);
			jobData.deletedRecords++;
			await this.updateJobData(jobId, jobData);
		}

		await this.updateJobData(jobId, jobData, { currentStep: "episodes" });
		const trackedEpisodes = await this.prisma.trackedEpisode.findMany({
			where: { userDid },
		});
		for (const tracked of trackedEpisodes) {
			await this.tryDeleteRecord(
				agent,
				session.did,
				EPISODE_COLLECTION,
				tracked.rkey,
				`Failed to delete episode record ${tracked.rkey} from PDS`,
			);
			jobData.deletedRecords++;
			await this.updateJobData(jobId, jobData);
		}

		await this.updateJobData(jobId, jobData, { currentStep: "follows" });
		const follows = await this.prisma.follow.findMany({
			where: { followerDid: userDid, rkey: { not: null } },
			select: { rkey: true },
		});
		for (const follow of follows) {
			if (!follow.rkey) {
				continue;
			}
			await this.tryDeleteRecord(
				agent,
				session.did,
				FOLLOW_COLLECTION,
				follow.rkey,
				`Failed to delete follow ${follow.rkey} from PDS`,
			);
			jobData.deletedRecords++;
			await this.updateJobData(jobId, jobData);
		}

		await this.updateJobData(jobId, jobData, { currentStep: "notes" });
		const notes = await this.prisma.note.findMany({
			where: { userDid },
			select: { rkey: true },
		});
		for (const note of notes) {
			await this.tryDeleteRecord(
				agent,
				session.did,
				NOTE_COLLECTION,
				note.rkey,
				`Failed to delete note ${note.rkey} from PDS`,
			);
			jobData.deletedRecords++;
			await this.updateJobData(jobId, jobData);
		}

		await this.updateJobData(jobId, jobData, { currentStep: "reviews" });
		const reviews = await this.prisma.review.findMany({
			where: { userDid },
			select: { rkey: true },
		});
		for (const review of reviews) {
			await this.tryDeleteRecord(
				agent,
				session.did,
				REVIEW_COLLECTION,
				review.rkey,
				`Failed to delete review ${review.rkey} from PDS`,
			);
			jobData.deletedRecords++;
			await this.updateJobData(jobId, jobData);
		}

		await this.updateJobData(jobId, jobData, { currentStep: "list_items" });
		const listItemRkeys = await this.listRepoRecordKeys(
			agent,
			session.did,
			LIST_ITEM_COLLECTION,
		);
		jobData.totalRecords += listItemRkeys.length;
		await this.updateJobData(jobId, jobData);
		for (const rkey of listItemRkeys) {
			await this.tryDeleteRecord(
				agent,
				session.did,
				LIST_ITEM_COLLECTION,
				rkey,
				`Failed to delete list item ${rkey} from PDS`,
			);
			jobData.deletedRecords++;
			await this.updateJobData(jobId, jobData);
		}

		await this.updateJobData(jobId, jobData, { currentStep: "lists" });
		const listRkeys = await this.listRepoRecordKeys(
			agent,
			session.did,
			LIST_COLLECTION,
		);
		jobData.totalRecords += listRkeys.length;
		await this.updateJobData(jobId, jobData);
		for (const rkey of listRkeys) {
			await this.tryDeleteRecord(
				agent,
				session.did,
				LIST_COLLECTION,
				rkey,
				`Failed to delete list ${rkey} from PDS`,
			);
			jobData.deletedRecords++;
			await this.updateJobData(jobId, jobData);
		}

		await this.updateJobData(jobId, jobData, { currentStep: "profile" });
		await this.tryDeleteRecord(
			agent,
			session.did,
			PROFILE_COLLECTION,
			"self",
			"Failed to delete profile record from PDS",
		);
		jobData.deletedRecords++;
		await this.updateJobData(jobId, jobData);
	}

	private async updateJobData(
		jobId: string,
		jobData: AccountDeletionJobData,
		overrides?: Partial<AccountDeletionJobData>,
	): Promise<void> {
		if (overrides) {
			Object.assign(jobData, overrides);
		}
		await this.prisma.backgroundJob.update({
			where: { id: jobId },
			data: { data: { ...jobData } },
		});
	}

	private async tryDeleteRecord(
		agent: Agent,
		repoDid: string,
		collection: string,
		rkey: string,
		warnPrefix: string,
	) {
		try {
			await agent.com.atproto.repo.deleteRecord({
				repo: repoDid,
				collection,
				rkey,
			});
		} catch (error) {
			if (this.isRecordMissingError(error)) {
				return;
			}
			this.logger.warn(`${warnPrefix}: ${error}`);
		}
	}

	private async listRepoRecordKeys(
		agent: Agent,
		repoDid: string,
		collection: string,
	): Promise<string[]> {
		const rkeys: string[] = [];
		let cursor: string | undefined;

		try {
			do {
				const response = await agent.com.atproto.repo.listRecords({
					repo: repoDid,
					collection,
					limit: RECORDS_PAGE_SIZE,
					cursor,
				});

				for (const record of response.data.records) {
					rkeys.push(this.extractRkeyFromUri(record.uri, repoDid, collection));
				}

				cursor = response.data.cursor;
			} while (cursor);
		} catch (error) {
			this.logger.warn(
				`Failed to list ${collection} records from PDS for user ${repoDid}: ${error}`,
			);
		}

		return rkeys;
	}

	private extractRkeyFromUri(
		uri: string,
		repoDid: string,
		collection: string,
	): string {
		const prefix = `at://${repoDid}/${collection}/`;

		if (!uri.startsWith(prefix)) {
			throw new Error(`Unexpected record URI returned from PDS: ${uri}`);
		}

		return uri.slice(prefix.length);
	}

	private async restoreSession(userDid: string): Promise<ATSession | null> {
		try {
			const session = await this.authService.restore(userDid);
			return session ? (session as unknown as ATSession) : null;
		} catch (error) {
			this.logger.warn(
				`Failed to restore auth session for ${userDid}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return null;
		}
	}

	private isRecordMissingError(error: unknown): boolean {
		if (!error || typeof error !== "object") {
			return false;
		}

		const candidate = error as {
			error?: string;
			status?: number;
			message?: string;
		};

		return (
			candidate.status === 404 ||
			candidate.error === "RecordNotFound" ||
			candidate.message?.includes("RecordNotFound") === true
		);
	}
}
