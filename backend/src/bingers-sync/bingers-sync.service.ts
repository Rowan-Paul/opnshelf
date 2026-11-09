import { SyncSnapshotChanged } from "../integrations/integration-error";
import { z } from "zod";
import type {
	IntegrationRemote,
	SyncRecordTypes,
} from "../integrations/adapter";
import { BadRequestException, Injectable } from "@nestjs/common";
import { OAuthIntegrationSyncService } from "../integrations/oauth-integration-sync.service";
import { BackendEnv } from "../config/env.schema";
import { Prisma, type IntegrationConnection } from "../generated/client";
import {
	type IntegrationSettings,
	type IntegrationResolve,
} from "../integrations/integration-sync.service";
import { LocalSyncRecords } from "../integrations/local-records.service";
import {
	readRecord,
	mediaKey,
	type SyncRecord,
} from "../integrations/reconcile";
import { PrismaService } from "../prisma/prisma.service";
import { WatchAccountLock } from "../privacy/watch-account-lock";
import {
	BingersSyncClient,
	BingersSyncError,
	BingersCursorRejected,
	type BingersFeed,
	type BingersToken,
	type BingersCredential,
} from "./bingers-sync.client";

/** Bingers as an Integration provider: OAuth, encrypted tokens and Bingers identity rules. */
@Injectable()
export class BingersSyncService extends OAuthIntegrationSyncService<
	BingersCredential,
	BingersToken
> {
	protected readonly provider = "bingers";
	protected readonly name = "Bingers";
	protected readonly remote: IntegrationRemote<BingersCredential>;
	constructor(
		prisma: PrismaService,
		private readonly api: BingersSyncClient,
		local: LocalSyncRecords,
		config: BackendEnv,
		watchLocks: WatchAccountLock,
	) {
		super(prisma, local, config, watchLocks);
		this.remote = {
			snapshot: (credential, types, leaseId) =>
				this.readSnapshot(credential, types, true, leaseId),
			readForRecord: async (credential, record) =>
				(await this.readSnapshot(credential, undefined, false)).filter(
					(r) => r.key === record.key,
				),
			write: () => api.write(),
		};
	}
	protected readonly authorizationEndpoint =
		"https://api.bingers.app/auth/oauth2/authorize";
	protected get oauth() {
		return this.api;
	}
	protected get callbackQuery() {
		return "provider=bingers&";
	}
	protected get connectionDefaults() {
		return { direction: "inbound" };
	}
	protected authorizationParams(state: string) {
		return {
			scope: "openid profile library:read offline_access",
			resource: "https://api.bingers.app/v1",
			nonce: state,
		};
	}
	protected tokenExpiry(token: BingersToken) {
		return new Date(Date.now() + token.expires_in * 1000);
	}
	protected async oauthProfile(token: BingersToken, nonce: string) {
		const profile = await this.api.profile(token.id_token, nonce);
		return { accountId: profile.sub, username: profile.name ?? "Bingers" };
	}
	protected async credential(c: IntegrationConnection) {
		return { connectionId: c.id, token: await this.accessToken(c) };
	}
	metadata() {
		return this.api.metadata();
	}
	protected async revoke(c: IntegrationConnection) {
		let failed = false;
		try {
			for (const token of [c.refreshToken, c.accessToken]) {
				if (!token) continue;
				try {
					await this.api.revoke(this.crypt(token, true));
				} catch {
					failed = true;
				}
			}
		} finally {
			await this.prisma.integrationConnection.update({
				where: { id: c.id },
				select: { id: true },
				data: { remoteFeed: {}, remoteSnapshot: [], remoteReadAt: null },
			});
		}
		if (failed) throw new Error("Bingers access could not be fully revoked.");
	}
	/** Feed state belongs to the Integration, not to its HTTP transport. */
	private async readSnapshot(
		c: BingersCredential,
		types?: SyncRecordTypes,
		persist = true,
		leaseId?: string,
	) {
		const row = await this.prisma.integrationConnection.findUniqueOrThrow({
			where: { id: c.connectionId },
			select: { remoteFeed: true },
		});
		const saved = z
			.object({
				cursor: z.string().min(1).optional(),
				records: z.array(z.unknown()).optional(),
			})
			.parse(row.remoteFeed);
		if (Boolean(saved.cursor) !== Boolean(saved.records))
			throw new BingersSyncError(
				"Bingers saved history is incomplete. No records were removed.",
			);
		if (!persist && !saved.cursor)
			throw new BingersSyncError(
				"Bingers history is not ready for confirmation. Run sync first.",
			);
		const records = (saved.records ?? []).map((value) => {
			const record = readRecord(value);
			if (!record)
				throw new BingersSyncError(
					"Bingers saved history could not be read. No records were removed.",
				);
			return record;
		});
		let feed: BingersFeed;
		try {
			feed = await this.api.readFeed(c.token, {
				cursor: saved.cursor,
				records,
			});
		} catch (error) {
			if (!(error instanceof BingersCursorRejected) || !persist) throw error;
			// Discard only the in-memory attempt. Never publish an empty or partial replacement.
			feed = await this.api.readFeed(c.token);
		}
		if (persist) {
			if (!leaseId)
				throw new SyncSnapshotChanged(
					"Bingers Sync ownership changed. Previous history was retained.",
				);
			const savedFeed = await this.prisma.integrationConnection.updateMany({
				where: {
					id: c.connectionId,
					leaseId,
					leaseUntil: { gt: new Date() },
				},
				data: { remoteFeed: feed as unknown as Prisma.InputJsonValue },
			});
			if (savedFeed.count !== 1)
				throw new SyncSnapshotChanged(
					"Bingers Sync ownership changed. Previous history was retained.",
				);
		}
		return feed.records.filter((r) =>
			r.kind === "watch" ? types?.watches !== false : types?.ratings !== false,
		);
	}
	protected inReadScope(record: SyncRecord, target: SyncRecord) {
		return mediaKey(record) === mediaKey(target);
	}
	protected sameRemoteTitle(record: SyncRecord, peer: SyncRecord) {
		return this.mappingKey(record) === this.mappingKey(peer);
	}
	protected mappingKey(record: SyncRecord) {
		return record.key.split(":").slice(1).join(":");
	}
	async configure(userDid: string, dto: IntegrationSettings) {
		if (
			dto.direction !== "inbound" ||
			dto.lists ||
			dto.watchlist ||
			dto.favorites ||
			dto.notes ||
			dto.library ||
			dto.reviews
		)
			throw new BadRequestException(
				"Bingers supports incoming Watches and Ratings only.",
			);
		return super.configure(userDid, dto);
	}
	async resolveIssue(userDid: string, id: string, dto: IntegrationResolve) {
		if (dto.action === "opnshelf")
			throw new BadRequestException(
				"Sending changes to Bingers is not supported.",
			);
		return super.resolveIssue(userDid, id, dto);
	}
}
