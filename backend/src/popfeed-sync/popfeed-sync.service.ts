import { Agent } from "@atproto/api";
import { IdResolver } from "@atproto/identity";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import { safeFetch } from "../common/safe-fetch";
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
import { PopfeedMediaService } from "./popfeed-media";
import {
	type PopfeedCredential,
	PopfeedSyncClient,
} from "./popfeed-sync.client";
import { type PopfeedRepo, PopfeedWriter } from "./popfeed-writer";

const POSTER_SOURCE = "https://image.tmdb.org/t/p/w500";
// Popfeed's own posters are well under this; never upload an unbounded image.
const POSTER_MAX_BYTES = 1_000_000;

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
		private readonly media: PopfeedMediaService,
		@Inject(AUTH_SERVICE) private readonly auth: Pick<AuthService, "restore">,
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
				select: { timezone: true, popfeedWriteEnabled: true },
			}),
			this.identity.did.resolveAtprotoData(c.userDid).catch(() => null),
		]);
		if (!data?.pds)
			throw new IntegrationError(
				"Your repository could not be located. Sync will retry.",
			);
		const credential: PopfeedCredential = {
			did: c.userDid,
			pds: data.pds,
			timeZone: owner.timezone,
		};
		if (!owner.popfeedWriteEnabled) return credential;
		const session = await this.auth.restore(c.userDid);
		if (!session)
			throw new IntegrationError(
				"Sign in to Opnshelf again to keep sending changes to Popfeed.",
				401,
			);
		credential.writer = new PopfeedWriter(
			this.repository(new Agent(session), credential),
			this.media,
			owner.timezone,
		);
		return credential;
	}

	/** Popfeed records in the User's repository, written with their own session. */
	private repository(agent: Agent, credential: PopfeedCredential): PopfeedRepo {
		const repo = credential.did;
		const rkey = (uri: string) => {
			const [, , did, collection, key] = uri.split("/");
			if (did !== repo || !collection || !key)
				throw new IntegrationError(
					"This Popfeed record is not in your repository.",
				);
			return { collection, rkey: key };
		};
		return {
			read: () => this.remote.repository(credential),
			create: async (collection, record) =>
				(
					await agent.com.atproto.repo.createRecord({
						repo,
						collection,
						record,
					})
				).data.uri,
			put: async (uri, record) => {
				await agent.com.atproto.repo.putRecord({ repo, ...rkey(uri), record });
			},
			remove: async (uri) => {
				await agent.com.atproto.repo.deleteRecord({ repo, ...rkey(uri) });
			},
			poster: async (posterPath) => {
				try {
					const response = await safeFetch(`${POSTER_SOURCE}${posterPath}`, {
						signal: AbortSignal.timeout(10_000),
					});
					const type = response.headers.get("content-type") ?? "";
					if (!response.ok || !type.startsWith("image/")) return undefined;
					const bytes = Buffer.from(await response.arrayBuffer());
					if (bytes.byteLength > POSTER_MAX_BYTES) return undefined;
					return (await agent.uploadBlob(bytes, { encoding: type })).data.blob;
				} catch {
					// Popfeed records also carry posterUrl; a missing blob is not fatal.
					return undefined;
				}
			},
		};
	}
	protected credentialed() {
		return true;
	}
	protected async revoke() {}
	// A scoped read returns every Popfeed record of the target's kind.
	protected inReadScope(record: SyncRecord, target: SyncRecord) {
		return record.kind === target.kind;
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
	async status(userDid: string) {
		const [status, owner] = await Promise.all([
			super.status(userDid),
			this.prisma.user.findUnique({
				where: { did: userDid },
				select: { popfeedWriteEnabled: true },
			}),
		]);
		return { ...status, writeAccess: owner?.popfeedWriteEnabled ?? false };
	}
	async configure(userDid: string, dto: IntegrationSettings) {
		if (dto.direction !== "inbound") {
			const owner = await this.prisma.user.findUniqueOrThrow({
				where: { did: userDid },
				select: { popfeedWriteEnabled: true },
			});
			if (!owner.popfeedWriteEnabled)
				throw new BadRequestException(
					"Allow Opnshelf to write your Popfeed records before sending changes to Popfeed.",
				);
		}
		if (dto.favorites || dto.notes || dto.library)
			throw new BadRequestException(
				"Popfeed has no Favorites, Notes or Library Items to sync.",
			);
		return super.configure(userDid, dto);
	}
}
