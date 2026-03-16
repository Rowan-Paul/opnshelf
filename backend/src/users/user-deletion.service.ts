import { Agent } from "@atproto/api";
import {
	BadGatewayException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { $nsid as EPISODE_COLLECTION } from "../lexicons/xyz/opnshelf/episode";
import { $nsid as FOLLOW_COLLECTION } from "../lexicons/xyz/opnshelf/follow";
import { $nsid as LIST_COLLECTION } from "../lexicons/xyz/opnshelf/list";
import { $nsid as LIST_ITEM_COLLECTION } from "../lexicons/xyz/opnshelf/listItem";
import { $nsid as MOVIE_COLLECTION } from "../lexicons/xyz/opnshelf/movie";
import { PrismaService } from "../prisma/prisma.service";

interface ATSession {
	did: string;
}

const PDS_DELETION_FAILURE_MESSAGE =
	"Failed to delete OpnShelf data from your PDS. Your account was not deleted.";
const RECORDS_PAGE_SIZE = 100;

@Injectable()
export class UserDeletionService {
	private readonly logger = new Logger(UserDeletionService.name);

	constructor(private readonly prisma: PrismaService) {}

	async deleteUser(
		did: string,
		session: ATSession,
		deletePDSData: boolean,
	): Promise<void> {
		const user = await this.prisma.user.findUnique({
			where: { did },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		if (deletePDSData) {
			await this.deletePdsRecords(did, session);
		}

		await this.prisma.user.delete({
			where: { did },
		});
	}

	private async deletePdsRecords(did: string, session: ATSession) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const trackedMovies = await this.prisma.trackedMovie.findMany({
			where: { userDid: did },
		});

		for (const tracked of trackedMovies) {
			await this.tryDeleteRecord(
				agent,
				session.did,
				MOVIE_COLLECTION,
				tracked.rkey,
				`Failed to delete record ${tracked.rkey} from PDS`,
			);
		}

		const trackedEpisodes = await this.prisma.trackedEpisode.findMany({
			where: { userDid: did },
		});

		for (const tracked of trackedEpisodes) {
			await this.tryDeleteRecord(
				agent,
				session.did,
				EPISODE_COLLECTION,
				tracked.rkey,
				`Failed to delete episode record ${tracked.rkey} from PDS`,
			);
		}

		const follows = await this.prisma.follow.findMany({
			where: { followerDid: did, rkey: { not: null } },
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
		}

		await this.deleteRepoCollectionRecords(
			agent,
			session.did,
			LIST_ITEM_COLLECTION,
			did,
		);
		await this.deleteRepoCollectionRecords(
			agent,
			session.did,
			LIST_COLLECTION,
			did,
		);
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
			this.logger.warn(`${warnPrefix}: ${error}`);
		}
	}

	private async deleteRepoCollectionRecords(
		agent: Agent,
		repoDid: string,
		collection: string,
		userDid: string,
	): Promise<void> {
		const rkeys = await this.listRepoRecordKeys(
			agent,
			repoDid,
			collection,
			userDid,
		);

		for (const rkey of rkeys) {
			await this.deleteRepoRecordOrThrow(
				agent,
				repoDid,
				collection,
				rkey,
				userDid,
			);
		}
	}

	private async listRepoRecordKeys(
		agent: Agent,
		repoDid: string,
		collection: string,
		userDid: string,
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
			this.logger.error(
				`Failed to list ${collection} records from PDS for user ${userDid}`,
				error,
			);
			throw new BadGatewayException(PDS_DELETION_FAILURE_MESSAGE);
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

	private async deleteRepoRecordOrThrow(
		agent: Agent,
		repoDid: string,
		collection: string,
		rkey: string,
		userDid: string,
	): Promise<void> {
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

			this.logger.error(
				`Failed to delete ${collection} record ${rkey} from PDS for user ${userDid}`,
				error,
			);
			throw new BadGatewayException(PDS_DELETION_FAILURE_MESSAGE);
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
