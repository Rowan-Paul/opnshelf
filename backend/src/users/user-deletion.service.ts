import { Agent } from "@atproto/api";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { $nsid as EPISODE_COLLECTION } from "../lexicons/xyz/opnshelf/episode";
import { $nsid as LIST_COLLECTION } from "../lexicons/xyz/opnshelf/list";
import { $nsid as LIST_ITEM_COLLECTION } from "../lexicons/xyz/opnshelf/listItem";
import { $nsid as MOVIE_COLLECTION } from "../lexicons/xyz/opnshelf/movie";
import { PrismaService } from "../prisma/prisma.service";

interface ATSession {
	did: string;
}

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
		try {
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

			const listItems = await this.prisma.listItem.findMany({
				where: { list: { userDid: did } },
			});

			for (const item of listItems) {
				await this.tryDeleteRecord(
					agent,
					session.did,
					LIST_ITEM_COLLECTION,
					item.rkey,
					`Failed to delete list item ${item.rkey} from PDS`,
				);
			}

			const lists = await this.prisma.movieList.findMany({
				where: { userDid: did },
			});

			for (const list of lists) {
				await this.tryDeleteRecord(
					agent,
					session.did,
					LIST_COLLECTION,
					list.rkey,
					`Failed to delete list ${list.rkey} from PDS`,
				);
			}
		} catch (error) {
			this.logger.error(`Failed to delete PDS records for user ${did}`, error);
		}
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
}
