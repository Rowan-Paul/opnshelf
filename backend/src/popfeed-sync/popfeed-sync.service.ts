import { IdResolver } from "@atproto/identity";
import { BadRequestException, Injectable } from "@nestjs/common";
import { BackendEnv } from "../config/env.schema";
import type { IntegrationConnection } from "../generated/client";
import {
	IntegrationSyncService,
	type IntegrationSettings,
} from "../integrations/integration-sync.service";
import { IntegrationError } from "../integrations/integration-error";
import { LocalSyncRecords } from "../integrations/local-records.service";
import type { SyncRecord } from "../integrations/reconcile";
import { PrismaService } from "../prisma/prisma.service";
import { WatchAccountLock } from "../privacy/watch-account-lock";
import {
	type PopfeedCredential,
	PopfeedSyncClient,
} from "./popfeed-sync.client";

/**
 * Popfeed as an Integration provider. Its records live in the User's own
 * repository, so there is no external account: the connection is the User.
 */
@Injectable()
export class PopfeedSyncService extends IntegrationSyncService<PopfeedCredential> {
	protected readonly provider = "popfeed";
	protected readonly name = "Popfeed";
	protected readonly remote: PopfeedSyncClient;
	private readonly identity: IdResolver;
	constructor(
		prisma: PrismaService,
		api: PopfeedSyncClient,
		local: LocalSyncRecords,
		config: BackendEnv,
		watchLocks: WatchAccountLock,
	) {
		super(prisma, local, config, watchLocks);
		this.remote = api;
		this.identity = new IdResolver({ plcUrl: config.PLC_DIRECTORY_URL });
	}
	protected get configured() {
		return true;
	}
	protected async credential(
		c: IntegrationConnection,
	): Promise<PopfeedCredential> {
		const [owner, data] = await Promise.all([
			this.prisma.user.findUniqueOrThrow({
				where: { did: c.userDid },
				select: { timezone: true },
			}),
			this.identity.did.resolveAtprotoData(c.userDid).catch(() => null),
		]);
		if (!data?.pds)
			throw new IntegrationError(
				"Your repository could not be located. Sync will retry.",
			);
		return { did: c.userDid, pds: data.pds, timeZone: owner.timezone };
	}
	protected credentialed() {
		return true;
	}
	protected async revoke() {}
	// Only inbound transfers exist, so no write is ever confirmed by a scoped read.
	protected inReadScope(record: SyncRecord, target: SyncRecord) {
		return record.key === target.key;
	}
	// Popfeed records carry no title identifier, so a TMDB match applies to one record.
	protected sameRemoteTitle() {
		return false;
	}
	protected mappingKey() {
		return null;
	}

	async connect(userDid: string) {
		const user = await this.prisma.user.findUniqueOrThrow({
			where: { did: userDid },
			select: { handle: true },
		});
		const existing = await this.current(userDid);
		if (!existing)
			await this.prisma.integrationConnection.create({
				data: {
					userDid,
					provider: this.provider,
					accountId: userDid,
					username: user.handle,
					direction: "inbound",
				},
			});
		else if (existing.status === "disconnected")
			await this.locked(existing, async () => {
				await this.prisma.integrationConnection.update({
					select: { id: true },
					where: { id: existing.id },
					data: { status: "paused", username: user.handle, lastError: null },
				});
			});
		return this.status(userDid);
	}
	async configure(userDid: string, dto: IntegrationSettings) {
		if (dto.direction !== "inbound")
			throw new BadRequestException(
				"Popfeed Sync reads from Popfeed only for now. Opnshelf → Popfeed is not available yet.",
			);
		if (dto.favorites || dto.notes || dto.library)
			throw new BadRequestException(
				"Popfeed has no Favorites, Notes or Library Items to sync.",
			);
		return super.configure(userDid, dto);
	}
}
