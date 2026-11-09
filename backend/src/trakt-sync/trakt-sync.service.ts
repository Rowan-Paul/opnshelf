import { Injectable } from "@nestjs/common";
import { OAuthIntegrationSyncService } from "../integrations/oauth-integration-sync.service";
import { BackendEnv } from "../config/env.schema";
import type { IntegrationConnection } from "../generated/client";
import { isContentRecord } from "../integrations/content-value";
import { type IntegrationIssuesQuery } from "../integrations/integration-sync.service";
import type { ListValue } from "../integrations/list-value";
import { LocalSyncRecords } from "../integrations/local-records.service";
import {
	isListRecord,
	mediaKey,
	type SyncRecord,
} from "../integrations/reconcile";
import { PrismaService } from "../prisma/prisma.service";
import { WatchAccountLock } from "../privacy/watch-account-lock";
import { TraktSyncClient, type TraktToken } from "./trakt-sync.client";
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
export class TraktSyncService extends OAuthIntegrationSyncService<
	string,
	TraktToken
> {
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
	protected readonly authorizationEndpoint = "https://trakt.tv/oauth/authorize";
	protected get oauth() {
		return this.api;
	}
	protected get returnPath() {
		return "trakt-sync";
	}
	protected tokenExpiry(token: TraktToken) {
		return new Date((token.created_at + token.expires_in) * 1000);
	}
	protected async oauthProfile(token: TraktToken) {
		const profile = await this.api.profile(token.access_token);
		return { accountId: profile.ids.uuid, username: profile.username };
	}
	protected credential(c: IntegrationConnection) {
		return this.accessToken(c);
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
