import { Agent } from "@atproto/api";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
	UpdateUserSettingsDto,
	UserSettingsDto,
} from "./dto/user-settings.dto";

const COLLECTION = "app.opnshelf.movie";

interface ATSession {
	did: string;
}

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Get user settings by DID
	 */
	async getUserSettings(did: string): Promise<UserSettingsDto> {
		const user = await this.prisma.user.findUnique({
			where: { did },
			select: {
				timezone: true,
				timeFormat: true,
			},
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		return {
			timezone: user.timezone,
			timeFormat: user.timeFormat,
		};
	}

	/**
	 * Update user settings
	 */
	async updateUserSettings(
		did: string,
		dto: UpdateUserSettingsDto,
	): Promise<UserSettingsDto> {
		const user = await this.prisma.user.findUnique({
			where: { did },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const updatedUser = await this.prisma.user.update({
			where: { did },
			data: {
				...(dto.timezone !== undefined && { timezone: dto.timezone }),
				...(dto.timeFormat !== undefined && { timeFormat: dto.timeFormat }),
			},
			select: {
				timezone: true,
				timeFormat: true,
			},
		});

		this.logger.log(`Updated settings for user ${did}`);

		return {
			timezone: updatedUser.timezone,
			timeFormat: updatedUser.timeFormat,
		};
	}

	/**
	 * Delete user account
	 * @param did - User's DID
	 * @param session - AT Protocol session for PDS operations
	 * @param deletePDSData - Whether to delete data from user's PDS
	 */
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
			try {
				const agent = new Agent(
					session as unknown as ConstructorParameters<typeof Agent>[0],
				);

				const trackedMovies = await this.prisma.trackedMovie.findMany({
					where: { userDid: did },
				});

				for (const tracked of trackedMovies) {
					try {
						await agent.com.atproto.repo.deleteRecord({
							repo: session.did,
							collection: COLLECTION,
							rkey: tracked.rkey,
						});
						this.logger.log(
							`Deleted AT record with rkey ${tracked.rkey} from PDS`,
						);
					} catch (error) {
						this.logger.warn(
							`Failed to delete record ${tracked.rkey} from PDS: ${error}`,
						);
					}
				}

				this.logger.log(
					`Deleted ${trackedMovies.length} records from PDS for user ${did}`,
				);
			} catch (error) {
				this.logger.error(
					`Failed to delete PDS records for user ${did}`,
					error,
				);
			}
		}

		await this.prisma.user.delete({
			where: { did },
		});

		this.logger.log(`Deleted user ${did} and all associated data`);
	}
}
