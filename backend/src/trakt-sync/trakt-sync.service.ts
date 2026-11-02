import {
	BadRequestException,
	ConflictException,
	HttpException,
	Injectable,
} from "@nestjs/common";
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
import { ZodError } from "zod";
import { BackendEnv } from "../config/env.schema";
import type { IntegrationConnection } from "../generated/client";
import { isContentRecord } from "../integrations/content-value";
import {
	IntegrationSyncService,
	type IntegrationIssuesQuery,
} from "../integrations/integration-sync.service";
import type { ListValue } from "../integrations/list-value";
import { LocalSyncRecords } from "../integrations/local-records.service";
import {
	isListRecord,
	mediaKey,
	type SyncRecord,
} from "../integrations/reconcile";
import { PrismaService } from "../prisma/prisma.service";
import { WatchAccountLock } from "../privacy/watch-account-lock";
import {
	TraktSyncClient,
	TraktSyncError,
	type TraktToken,
} from "./trakt-sync.client";
import { validateOutboundContent } from "./remote-content";
import type { SyncResolveDto } from "./trakt-sync.dto";

// The readback endpoints cover a Watch title, a Rating category, or an entire
// List/content kind. Use the same scope for pre-write checks and cache updates.
const inRemoteScope = (
	record: SyncRecord,
	target: SyncRecord,
	previous?: SyncRecord | null,
) =>
	target.kind === "list" && target.remoteId
		? record.kind === "list" &&
			(record.remoteId === target.remoteId || record.key === previous?.key)
		: isListRecord(target) || isContentRecord(target)
			? record.kind === target.kind
			: target.kind === "rating"
				? record.kind === "rating" && record.mediaType === target.mediaType
				: record.key === previous?.key || mediaKey(record) === mediaKey(target);
const sameTraktTitle = (record: SyncRecord, peer: SyncRecord): boolean => {
	if (isContentRecord(record) || isContentRecord(peer))
		return Boolean(
			record.kind === peer.kind &&
				record.remoteParentId &&
				peer.remoteParentId === record.remoteParentId &&
				(record.mediaType === "movie") === (peer.mediaType === "movie"),
		);
	return record.mediaType === "movie"
		? peer.mediaType === "movie" && peer.remoteId === record.remoteId
		: Boolean(
				peer.mediaType !== "movie" &&
					record.remoteParentId &&
					peer.remoteParentId === record.remoteParentId,
			);
};
// Content IDs identify individual records; their parent identifies the title.
const traktMappingKey = (record: SyncRecord): string | null => {
	const parent = isContentRecord(record) || record.mediaType !== "movie";
	const id = parent ? record.remoteParentId : record.remoteId;
	if (parent && !id) return null;
	return `${record.kind}:${record.mediaType === "movie"}:${typeof id}:${id}`;
};

/** Trakt as an Integration provider: OAuth, encrypted tokens and Trakt identity rules. */
@Injectable()
export class TraktSyncService extends IntegrationSyncService<string> {
	protected readonly provider = "trakt";
	protected readonly name = "Trakt";
	protected readonly remote: TraktSyncClient;
	constructor(
		prisma: PrismaService,
		private readonly api: TraktSyncClient,
		local: LocalSyncRecords,
		config: BackendEnv,
		watchLocks: WatchAccountLock,
	) {
		super(prisma, local, config, watchLocks);
		this.remote = api;
	}
	protected get configured() {
		return this.api.configured && Boolean(this.config.PROVIDER_STATE_SECRET);
	}
	private crypt(value: string, decrypt = false) {
		if (!this.config.PROVIDER_STATE_SECRET)
			throw new BadRequestException("Trakt Sync is not configured.");
		const key = createHash("sha256")
			.update(`opnshelf-trakt-sync:${this.config.PROVIDER_STATE_SECRET}`)
			.digest();
		if (decrypt) {
			const data = Buffer.from(value, "base64url");
			const cipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
			cipher.setAuthTag(data.subarray(12, 28));
			return Buffer.concat([
				cipher.update(data.subarray(28)),
				cipher.final(),
			]).toString();
		}
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", key, iv);
		const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
		return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
			"base64url",
		);
	}
	private tokenData(t: TraktToken) {
		return {
			accessToken: this.crypt(t.access_token),
			refreshToken: this.crypt(t.refresh_token),
			expiresAt: new Date((t.created_at + t.expires_in) * 1000),
		};
	}
	async authorize(
		userDid: string,
		platform: "web" | "mobile",
		returnTo?: "onboarding",
	) {
		if (!this.configured)
			throw new BadRequestException(
				"Trakt Sync is not configured on this server.",
			);
		const verifier = randomBytes(32).toString("base64url");
		const state = randomBytes(32).toString("base64url");
		await this.prisma.authState.create({
			data: {
				key: `trakt:${state}`,
				stateData: this.crypt(
					JSON.stringify({ userDid, verifier, platform, returnTo }),
				),
				expiresAt: new Date(Date.now() + 10 * 60_000),
			},
		});
		const url = new URL("https://trakt.tv/oauth/authorize");
		for (const [k, v] of Object.entries({
			client_id: this.api.clientId,
			response_type: "code",
			redirect_uri: this.api.callbackUrl,
			state,
			code_challenge: createHash("sha256").update(verifier).digest("base64url"),
			code_challenge_method: "S256",
		}))
			url.searchParams.set(k, v);
		return { url: url.toString() };
	}
	async callback(state: string, code?: string) {
		let redirect = `${this.config.FRONTEND_URL}/trakt-sync`;
		let stage = "state-validation";
		try {
			const saved = await this.prisma.authState.findUnique({
				where: { key: `trakt:${state}` },
			});
			const data = JSON.parse(this.crypt(saved?.stateData ?? "", true)) as {
				userDid: string;
				verifier: string;
				platform: string;
				returnTo?: string;
			};
			const path = data.returnTo === "onboarding" ? "onboarding" : "trakt-sync";
			redirect =
				data.platform === "mobile"
					? `opnshelf://${path}`
					: `${this.config.FRONTEND_URL}/${path}`;
			if (!saved || saved.expiresAt <= new Date())
				throw new BadRequestException(
					"Trakt authorization expired. Start again.",
				);
			const claimed = await this.prisma.authState.deleteMany({
				where: { key: saved.key, expiresAt: { gt: new Date() } },
			});
			if (claimed.count !== 1)
				throw new BadRequestException(
					"Trakt authorization has already been used.",
				);
			if (!code) return `${redirect}?connection=cancelled`;
			stage = "token-exchange";
			const token = await this.api.exchange(code, data.verifier);
			try {
				stage = "profile-fetch";
				const profile = await this.api.profile(token.access_token);
				stage = "connection-save";
				const previous = await this.current(data.userDid);
				if (
					previous &&
					previous.status !== "disconnected" &&
					previous.accountId !== profile.ids.uuid
				)
					throw new ConflictException(
						"Disconnect the current Trakt account before switching.",
					);
				const existing = await this.prisma.integrationConnection.findUnique({
					where: {
						userDid_provider_accountId: {
							userDid: data.userDid,
							provider: this.provider,
							accountId: profile.ids.uuid,
						},
					},
				});
				if (existing)
					await this.locked(existing, async () => {
						await this.prisma.integrationConnection.update({
							select: { id: true },
							where: { id: existing.id },
							data: {
								...this.tokenData(token),
								username: profile.username,
								status: "paused",
								lastError: null,
							},
						});
					});
				else
					await this.prisma.integrationConnection.create({
						data: {
							userDid: data.userDid,
							provider: this.provider,
							accountId: profile.ids.uuid,
							username: profile.username,
							...this.tokenData(token),
						},
					});
			} catch (error) {
				await this.api.revoke(token.access_token).catch(() => undefined);
				throw error;
			}
			return `${redirect}?connection=connected`;
		} catch (error) {
			// Never log exception messages, payloads, codes, state, or credentials.
			this.logger.warn(
				JSON.stringify({
					message: "Trakt OAuth callback failed",
					stage,
					category:
						error instanceof TraktSyncError
							? "trakt-api"
							: error instanceof ZodError
								? "response-validation"
								: error instanceof HttpException
									? "request-validation"
									: "internal",
					status:
						error instanceof TraktSyncError
							? error.status
							: error instanceof HttpException
								? error.getStatus()
								: undefined,
					response:
						error instanceof TraktSyncError ? error.diagnostics : undefined,
				}),
			);
			return `${redirect}?connection=failed`;
		}
	}
	protected async credential(c: IntegrationConnection) {
		const current = await this.prisma.integrationConnection.findUniqueOrThrow({
			where: { id: c.id },
			select: {
				id: true,
				accessToken: true,
				refreshToken: true,
				expiresAt: true,
			},
		});
		if (!current.accessToken || !current.refreshToken)
			throw new BadRequestException("Connect Trakt first.");
		if (
			!current.expiresAt ||
			current.expiresAt.getTime() < Date.now() + 60_000
		) {
			try {
				const fresh = await this.api.refresh(
					this.crypt(current.refreshToken, true),
				);
				await this.prisma.integrationConnection.update({
					select: { id: true },
					where: { id: current.id },
					data: this.tokenData(fresh),
				});
				return fresh.access_token;
			} catch (error) {
				if (
					!(error instanceof TraktSyncError) ||
					![400, 401].includes(error.status)
				)
					throw error;
				await this.prisma.integrationConnection.update({
					select: { id: true },
					where: { id: current.id },
					data: {
						status: "reconnect",
						lastError: "Reconnect Trakt to continue syncing.",
					},
				});
				throw new TraktSyncError("Reconnect Trakt to continue syncing.", 401);
			}
		}
		return this.crypt(current.accessToken, true);
	}
	protected credentialed(c: IntegrationConnection) {
		return Boolean(c.accessToken);
	}
	protected async revoke(c: IntegrationConnection) {
		if (c.accessToken) await this.api.revoke(this.crypt(c.accessToken, true));
	}
	protected inReadScope(
		record: SyncRecord,
		target: SyncRecord,
		previous?: SyncRecord | null,
	) {
		return inRemoteScope(record, target, previous);
	}
	protected sameRemoteTitle(record: SyncRecord, peer: SyncRecord) {
		return sameTraktTitle(record, peer);
	}
	protected mappingKey(record: SyncRecord) {
		return traktMappingKey(record);
	}
	protected validateOutboundContent(record: SyncRecord) {
		validateOutboundContent(record);
	}
	protected validateOutboundList(value: ListValue) {
		if (value.items.some((item) => item.notes.length > 500))
			throw new Error(
				"A List note exceeds Trakt's 500-character limit. No text was truncated.",
			);
	}
	/** The Trakt API names the remote side "trakt"; the shared core calls it "remote". */
	async resolve(userDid: string, id: string, dto: SyncResolveDto) {
		const { confirmedTraktMissing, ...rest } = dto;
		return this.resolveIssue(userDid, id, {
			...rest,
			action: dto.action === "trakt" ? "remote" : dto.action,
			confirmedRemoteMissing: confirmedTraktMissing,
		});
	}
	async issues(userDid: string, query: IntegrationIssuesQuery) {
		const page = await this.listIssues(userDid, query);
		return {
			...page,
			items: page.items.map(({ remote, remoteState, ...item }) => ({
				...item,
				traktState: remoteState,
				trakt: remote,
			})),
		};
	}
}
