import {
	contentValue,
	isContentRecord,
	validateOutboundContent,
} from "../integrations/content-value";
import { TID } from "@atproto/common";
import {
	encodeList,
	listValue,
	memberKey,
	validateList,
} from "../integrations/list-value";
import {
	WatchAccountBusyError,
	WatchAccountLock,
	type WithAccountWrite,
	type AccountLockMode,
} from "../privacy/watch-account-lock";
import { watchOperation } from "../privacy/watch-operation";
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	randomUUID,
} from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	HttpException,
	Injectable,
	Logger,
	NotFoundException,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { ZodError } from "zod";
import { BackendEnv } from "../config/env.schema";
import {
	Prisma,
	type IntegrationConnection,
	type IntegrationEntry,
} from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import { getPaginationMeta } from "../common/pagination";
import { LocalSyncRecords } from "../integrations/local-records.service";
import {
	candidates,
	isListRecord,
	decide,
	equivalent,
	fingerprint,
	mediaKey,
	readRecord,
	type Direction,
	type SyncRecord,
} from "../integrations/reconcile";
import {
	TraktSyncClient,
	TraktSyncError,
	type TraktToken,
} from "./trakt-sync.client";
import type {
	SyncIssuesQueryDto,
	SyncResolveDto,
	SyncSettingsDto,
	SyncStatusDto,
} from "./trakt-sync.dto";

class SyncAccountUnavailable extends TraktSyncError {}
class SyncSnapshotChanged extends TraktSyncError {}

/** Integration provider whose connections this service owns (ADR 0051). */
const PROVIDER = "trakt";
const SOURCE_CHANGED =
	"The source changed during an interrupted transfer. Choose which version to keep.";
const json = (v: SyncRecord | null) =>
	v === null ? Prisma.DbNull : (v as unknown as Prisma.InputJsonValue);
const records = (v: unknown): SyncRecord[] =>
	Array.isArray(v)
		? v.map(readRecord).filter((r): r is SyncRecord => r !== null)
		: [];
const localVersion = (record: SyncRecord) =>
	JSON.stringify([fingerprint(record), record.cid, record.problem]);
const sameLocalSnapshot = (before: SyncRecord[], after: SyncRecord[]) => {
	const expected = new Map(
		before.map((record) => [record.key, localVersion(record)]),
	);
	return (
		before.length === after.length &&
		after.every((record) => expected.get(record.key) === localVersion(record))
	);
};
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
// An absent remote record is not proof that a non-idempotent POST failed.
const unconfirmedCreate = (
	entry: Pick<IntegrationEntry, "kind" | "pending" | "remoteKey">,
) => {
	const pending = entry.pending as {
		direction?: string;
		previous?: unknown;
	} | null;
	return Boolean(
		["list", "note", "review"].includes(entry.kind) &&
			pending?.direction === "push" &&
			!entry.remoteKey &&
			!pending.previous,
	);
};
const display = (r: SyncRecord | null) =>
	r
		? {
				key: r.key,
				kind: r.kind,
				mediaType: r.mediaType,
				mediaId: r.mediaId,
				title: r.title,
				season: r.season,
				episode: r.episode,
				displayValue: r.unreadable
					? "Trakt could not return the complete List. Its contents are preserved."
					: isContentRecord(r)
						? r.kind === "library"
							? `${({ digital: "Digital", bluray: "Blu-ray", bluray4k: "4K Blu-ray", dvd: "DVD" } as Record<string, string>)[contentValue(r).format] ?? "Unknown format"}${contentValue(r).boxSet ? ` · ${contentValue(r).boxSet}` : ""}${contentValue(r).notes ? ` · ${contentValue(r).notes}` : ""}`
							: `${contentValue(r).spoiler ? "Contains spoilers · " : ""}${contentValue(r).content}`
						: isListRecord(r)
							? `${r.title} · ${listValue(r).items.length} items · ${r.visibility ?? "private"} · ${listValue(r).description} · ${listValue(
									r,
								)
									.items.map(
										(i) =>
											`${i.mediaType} ${i.mediaId ?? "unmatched"}${i.season ? ` S${i.season}` : ""}${i.episode ? ` E${i.episode}` : ""}${i.notes ? ` (${i.notes})` : ""}`,
									)
									.join(", ")}`
							: r.value === null
								? "No date"
								: String(r.value),
			}
		: undefined;
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
const applyMappings = (
	remote: SyncRecord[],
	entries: Pick<IntegrationEntry, "remoteBase">[],
) => {
	let saved: Map<string, string> | undefined;
	return remote.map((r) => {
		if (isListRecord(r) || r.mediaId) return r;
		const key = traktMappingKey(r);
		if (key === null) return r;
		if (!saved) {
			saved = new Map();
			for (const entry of entries) {
				const record = readRecord(entry.remoteBase);
				if (!record?.mediaId || isListRecord(record)) continue;
				const mappedKey = traktMappingKey(record);
				// Preserve the first saved mapping when several records share a title.
				if (mappedKey !== null && !saved.has(mappedKey))
					saved.set(mappedKey, record.mediaId);
			}
		}
		const mediaId = saved.get(key);
		return mediaId ? { ...r, mediaId } : r;
	});
};
const enabled = (c: IntegrationConnection, r: Pick<SyncRecord, "kind">) =>
	r.kind === "watch"
		? c.watches
		: r.kind === "rating"
			? c.ratings
			: r.kind === "list"
				? c.lists
				: r.kind === "note"
					? c.notes
					: r.kind === "library"
						? c.library
						: r.kind === "review"
							? c.reviews
							: r.kind === "favorites"
								? c.favorites
								: c.watchlist;

@Injectable()
export class TraktSyncService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TraktSyncService.name);
	private timer?: NodeJS.Timeout;
	private busy = false;
	constructor(
		private readonly prisma: PrismaService,
		private readonly api: TraktSyncClient,
		private readonly local: LocalSyncRecords,
		private readonly config: BackendEnv,
		private readonly watchLocks: WatchAccountLock,
	) {}
	onModuleInit() {
		if (this.config.NODE_ENV !== "test")
			this.timer = setInterval(() => void this.tick(), 5000);
	}
	onModuleDestroy() {
		if (this.timer) clearInterval(this.timer);
	}
	private get configured() {
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
	private current(userDid: string) {
		return this.prisma.integrationConnection.findFirst({
			where: { userDid, provider: PROVIDER },
			orderBy: [{ updatedAt: "desc" }],
		});
	}
	async status(userDid: string): Promise<SyncStatusDto> {
		const c = await this.prisma.integrationConnection.findFirst({
			where: { userDid, provider: PROVIDER },
			orderBy: [{ updatedAt: "desc" }],
			omit: { remoteSnapshot: true },
		});
		const counts = c
			? await this.prisma.integrationEntry.groupBy({
					by: ["ignored"],
					where: {
						connectionId: c.id,
						issue: { not: null },
						OR: [{ eligible: true }, { linked: true }],
					},
					_count: true,
				})
			: [];
		return {
			configured: this.configured,
			syncState:
				c?.leaseUntil && c.leaseUntil > new Date()
					? "running"
					: c?.status !== "active"
						? "idle"
						: c.lastError && c.nextRunAt > new Date()
							? "waiting"
							: c.nextRunAt <= new Date()
								? "queued"
								: "idle",
			nextCheckAt: c?.nextRunAt.toISOString(),
			status:
				c?.status === "active" && !c.initialised
					? "preparing"
					: (c?.status ?? "disconnected"),
			username: c?.username,
			direction: c?.direction ?? "both",
			watches: c?.watches ?? true,
			ratings: c?.ratings ?? true,
			lists: c?.lists ?? false,
			watchlist: c?.watchlist ?? false,
			favorites: c?.favorites ?? false,
			notes: c?.notes ?? false,
			library: c?.library ?? false,
			reviews: c?.reviews ?? false,
			contentPublicationConsent: c?.contentPublicationConsent ?? false,
			listPublicationConsent: c?.listPublicationConsent ?? false,
			historyScope: c?.historyScope ?? "all",
			publicationConsent: c?.publicationConsent ?? false,
			lastSuccessAt: c?.lastSuccessAt?.toISOString(),
			lastError: c?.lastError ?? undefined,
			remaining: c?.status === "active" ? c.remaining : 0,
			progress:
				c?.status === "active" && c.remaining && c.remainingTotal
					? Math.floor(
							((c.remainingTotal - c.remaining) / c.remainingTotal) * 100,
						)
					: undefined,
			needsAttention: counts.find((g) => !g.ignored)?._count ?? 0,
			ignored: counts.find((g) => g.ignored)?._count ?? 0,
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
							provider: PROVIDER,
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
							provider: PROVIDER,
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
	private async locked<T>(
		c: IntegrationConnection,
		operation: (lease: () => Promise<void>) => Promise<T>,
	): Promise<T> {
		const leaseId = randomUUID();
		const claim = await this.prisma.integrationConnection.updateMany({
			where: {
				id: c.id,
				OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
			},
			data: { leaseId, leaseUntil: new Date(Date.now() + 120_000) },
		});
		if (!claim.count)
			throw new ConflictException(
				"Sync is finishing its current operation. Try again shortly.",
			);
		let lost = false;
		const lease = async () => {
			const updated = await this.prisma.integrationConnection.updateMany({
				where: { id: c.id, leaseId },
				data: { leaseUntil: new Date(Date.now() + 120_000) },
			});
			if (!updated.count) lost = true;
			if (lost)
				throw new ConflictException("Sync ownership changed. Try again.");
		};
		const heartbeat = setInterval(
			() =>
				void lease().catch(() => {
					lost = true;
				}),
			30_000,
		);
		try {
			return await operation(lease);
		} finally {
			clearInterval(heartbeat);
			await this.prisma.integrationConnection.updateMany({
				where: { id: c.id, leaseId },
				data: { leaseId: null, leaseUntil: null },
			});
		}
	}
	private async token(c: IntegrationConnection) {
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
	async configure(userDid: string, dto: SyncSettingsDto) {
		if (
			!dto.watches &&
			!dto.ratings &&
			!dto.lists &&
			!dto.watchlist &&
			!dto.favorites &&
			!dto.notes &&
			!dto.library &&
			!dto.reviews
		)
			throw new BadRequestException("Choose at least one record type.");
		if (
			dto.direction !== "outbound" &&
			(dto.watches || dto.ratings) &&
			!dto.publicationConsent
		)
			throw new BadRequestException(
				"Acknowledge that incoming Watches and Ratings become public.",
			);
		if (
			(dto.lists || dto.watchlist || dto.favorites) &&
			!dto.listPublicationConsent
		)
			throw new BadRequestException(
				"Acknowledge that private List contents may become public on the destination.",
			);
		if (
			(dto.notes || dto.library || dto.reviews) &&
			!dto.contentPublicationConsent
		)
			throw new BadRequestException(
				"Acknowledge that Notes, Library Items and Reviews may become public on the destination.",
			);
		const c = await this.requireConnection(userDid);
		await this.locked(c, async (lease) => {
			await this.token(c);
			await lease();
			const settings = { ...dto };
			settings.lists ??= false;
			settings.watchlist ??= false;
			settings.favorites ??= false;
			settings.notes ??= false;
			settings.library ??= false;
			settings.reviews ??= false;
			settings.contentPublicationConsent ??= false;
			settings.listPublicationConsent ??= false;
			await this.prisma.integrationConnection.update({
				select: { id: true },
				where: { id: c.id },
				data: {
					...settings,
					status: "active",
					initialised: false,
					remoteReadAt: null,
					nextRunAt: new Date(),
					lastError: null,
				},
			});
		});
		return this.status(userDid);
	}
	private async requireConnection(userDid: string) {
		const c = await this.current(userDid);
		if (!c) throw new NotFoundException("Connect Trakt first.");
		return c;
	}
	async action(
		userDid: string,
		action: "pause" | "resume" | "sync" | "disconnect",
	) {
		let c = await this.requireConnection(userDid);
		if (action === "sync") {
			if (c.lastError && c.nextRunAt > new Date()) return this.status(userDid);
			if (!c.accessToken || c.status === "reconnect")
				throw new BadRequestException("Reconnect Trakt first.");
			if (!c.initialised && !c.publicationConsent && c.direction !== "outbound")
				throw new BadRequestException("Choose your sync settings first.");
			// Repeated requests join the current run. The conditional update also
			// covers a worker claiming the lease after this request read the row.
			// This only schedules work; the worker still takes the shared account lock.
			// Joining an active run deliberately does not enqueue another remote read.
			await this.prisma.integrationConnection.updateMany({
				where: {
					id: c.id,
					status: c.status,
					OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
				},
				data: {
					status: "active",
					nextRunAt: new Date(),
					remoteReadAt: null,
					lastError: null,
				},
			});
			return this.status(userDid);
		}
		await this.locked(c, async () => {
			c = await this.prisma.integrationConnection.findUniqueOrThrow({
				where: { id: c.id },
			});
			if (action === "disconnect") {
				// Freeze first, even if remote revocation is temporarily unavailable.
				await this.prisma.integrationConnection.update({
					select: { id: true },
					where: { id: c.id },
					data: { status: "paused" },
				});
				try {
					if (c.accessToken)
						await this.api.revoke(this.crypt(c.accessToken, true));
				} catch {
					this.logger.warn(
						"Trakt revocation failed; disconnect will clear local credentials.",
					);
				}
				await this.prisma.integrationConnection.update({
					select: { id: true },
					where: { id: c.id },
					data: {
						status: "disconnected",
						accessToken: null,
						refreshToken: null,
						expiresAt: null,
						lastError: null,
					},
				});
			} else {
				if (!c.accessToken || c.status === "reconnect")
					throw new BadRequestException("Reconnect Trakt first.");
				if (
					!c.initialised &&
					!c.publicationConsent &&
					c.direction !== "outbound" &&
					action !== "pause"
				)
					throw new BadRequestException("Choose your sync settings first.");
				await this.prisma.integrationConnection.update({
					select: { id: true },
					where: { id: c.id },
					data: {
						status: action === "pause" ? "paused" : "active",
						nextRunAt: new Date(),
					},
				});
			}
		});
		return this.status(userDid);
	}
	async disconnectForDeletion(userDid: string) {
		const current = await this.current(userDid);
		if (current && current.status !== "disconnected")
			await this.action(userDid, "disconnect");
	}
	private async discover(
		c: IntegrationConnection,
		local: SyncRecord[],
		remote: SyncRecord[],
		known?: IntegrationEntry[],
	) {
		const entries =
			known ??
			(await this.prisma.integrationEntry.findMany({
				where: { connectionId: c.id },
			}));
		const usedLocal = new Set(entries.map((e) => e.localKey));
		const usedRemote = new Set(entries.map((e) => e.remoteKey));
		const localByKey = new Map(local.map((r) => [r.key, r]));
		const remoteByKey = new Map(remote.map((r) => [r.key, r]));
		// Compare only the same media; scanning every link for every Watch
		// blocks the API event loop for large Trakt histories.
		const groupByMedia = (items: SyncRecord[]) => {
			const groups = new Map<string, SyncRecord[]>();
			for (const item of items) {
				const key = mediaKey(item);
				const group = groups.get(key);
				if (group) group.push(item);
				else groups.set(key, [item]);
			}
			return groups;
		};
		const pendingByMedia = new Map<string, IntegrationEntry[]>();
		for (const e of entries) {
			if (!e.pending) continue;
			const desired = readRecord((e.pending as { desired?: unknown }).desired);
			if (!desired) continue;
			const key = mediaKey(desired);
			const group = pendingByMedia.get(key);
			if (group) group.push(e);
			else pendingByMedia.set(key, [e]);
		}
		const localByMedia = groupByMedia(local);
		const remoteByMedia = groupByMedia(remote);
		// Adopt a completed legacy recovery even if the process died before saving
		// its link. Never create a second PDS Watch over the recovered viewing.
		for (const e of entries) {
			if (e.localKey || e.linked || e.pending) continue;
			const r = remoteByKey.get(e.remoteKey ?? "");
			if (!r || r.value === null) continue;
			const matches = (localByMedia.get(mediaKey(r)) ?? []).filter(
				(l) => !usedLocal.has(l.key) && equivalent(l, r),
			);
			if (
				matches.length !== 1 ||
				(remoteByMedia.get(mediaKey(matches[0])) ?? []).filter((v) =>
					equivalent(v, matches[0]),
				).length !== 1
			)
				continue;
			const l = matches[0];
			await this.prisma.integrationEntry.update({
				select: { id: true },
				where: { id: e.id },
				data: {
					localKey: l.key,
					localBase: json(l),
					linked: e.eligible,
					issue: null,
				},
			});
			e.localKey = l.key;
			usedLocal.add(l.key);
			e.linked = e.eligible;
		}
		for (const e of entries) {
			if (!e.pending || !isContentRecord(e) || e.remoteKey) continue;
			const intent = e.pending as { direction?: string; desired?: unknown };
			const desired = readRecord(intent.desired);
			if (intent.direction !== "push" || !desired) continue;
			const current = localByKey.get(e.localKey ?? "");
			const possible = (remoteByMedia.get(mediaKey(desired)) ?? []).filter(
				(r) => !r.problem && equivalent(desired, r) && !usedRemote.has(r.key),
			);
			const intents = (pendingByMedia.get(mediaKey(desired)) ?? []).filter(
				(other) =>
					other.pending &&
					(other.pending as { direction?: string }).direction === "push" &&
					equivalent(
						desired,
						readRecord((other.pending as { desired?: unknown }).desired),
					),
			);
			if (!current || possible.length !== 1 || intents.length !== 1) continue;
			await this.complete(e, desired, possible[0]);
			e.remoteKey = possible[0].key;
			usedRemote.add(possible[0].key);
			e.pending = null;
			e.linked = true;
		}
		for (const e of entries) {
			if (!e.pending || !isListRecord(e)) continue;
			const intent = e.pending as { direction: string; desired?: unknown };
			const desired = readRecord(intent.desired);
			if (intent.direction !== "push" || e.remoteKey || !desired) continue;
			const possible = (remoteByMedia.get(mediaKey(desired)) ?? []).filter(
				(r) =>
					r.kind === desired.kind &&
					r.title === desired.title &&
					!usedRemote.has(r.key),
			);
			if (possible.some((r) => r.unreadable)) continue;
			if (possible.length === 1 && equivalent(desired, possible[0])) {
				const current = localByKey.get(e.localKey ?? "") ?? null;
				if (current && equivalent(current, desired)) {
					await this.complete(e, current, possible[0]);
					e.remoteKey = possible[0].key;
					usedRemote.add(possible[0].key);
					e.pending = null;
					e.linked = true;
					continue;
				}
			}
			if (possible.length === 1) {
				e.remoteKey = possible[0].key;
				usedRemote.add(possible[0].key);
				await this.prisma.integrationEntry.update({
					select: { id: true },
					where: { id: e.id },
					data: {
						remoteKey: e.remoteKey,
						remoteBase: json(possible[0]),
						pending: Prisma.DbNull,
						issue:
							"A List creation was interrupted. Choose which version to keep before continuing.",
						resolution: null,
					},
				});
			}
		}
		const missingWatchMedia = new Set<string>();
		let missingWatchWithoutBase = false;
		for (const e of entries) {
			if (!e.linked || !e.remoteKey || remoteByKey.has(e.remoteKey)) continue;
			const base = readRecord(e.remoteBase);
			if (base) missingWatchMedia.add(mediaKey(base));
			else missingWatchWithoutBase = true;
		}
		const newLocal = local.filter((r) => !usedLocal.has(r.key));
		const newRemote = remote.filter((r) => !usedRemote.has(r.key));
		const newRemoteByMedia = groupByMedia(newRemote);
		const creations: Prisma.IntegrationEntryCreateManyInput[] = [];
		const flush = async () => {
			if (!creations.length) return;
			await this.prisma.integrationEntry.createMany({ data: [...creations] });
			creations.length = 0;
		};
		for (const r of newRemote) {
			// A write may have reached Trakt before its acknowledgement was lost.
			// Let that durable intent claim the result before ordinary discovery.
			if (
				(pendingByMedia.get(mediaKey(r)) ?? []).some((e) => {
					if (
						!e.pending ||
						(e.pending as { direction?: string }).direction !== "push"
					)
						return false;
					const desired = readRecord(
						(e.pending as { desired?: unknown }).desired,
					);
					return (
						equivalent(desired, r) ||
						(r.unreadable &&
							isListRecord(r) &&
							!e.remoteKey &&
							desired?.kind === r.kind &&
							desired.title === r.title)
					);
				})
			)
				continue;
			const possibleReplacement =
				r.kind === "watch" &&
				(missingWatchWithoutBase || missingWatchMedia.has(mediaKey(r)));
			const matches =
				r.mediaId || isListRecord(r)
					? candidates(
							r,
							(localByMedia.get(mediaKey(r)) ?? []).filter(
								(l) => !usedLocal.has(l.key),
							),
						)
					: [];
			const match =
				matches.length === 1 &&
				((r.kind !== "watch" &&
					((!isListRecord(r) && !isContentRecord(r)) ||
						candidates(
							matches[0],
							newRemoteByMedia.get(mediaKey(matches[0])) ?? [],
						).length === 1)) ||
					(r.value !== null &&
						matches[0].value !== null &&
						equivalent(matches[0], r) &&
						candidates(
							matches[0],
							newRemoteByMedia.get(mediaKey(matches[0])) ?? [],
						).length === 1))
					? matches[0]
					: null;
			const eligible =
				enabled(c, r) && (c.initialised || c.historyScope === "all");
			creations.push({
				connectionId: c.id,
				kind: r.kind,
				remoteKey: r.key,
				localKey: match?.key,
				localBase: json(match),
				remoteBase: json(r),
				linked: Boolean(eligible && match && equivalent(match, r)),
				eligible,
				issue:
					r.problem ??
					(!r.mediaId && !isListRecord(r)
						? "Choose a TMDB match for this title."
						: possibleReplacement || (!match && matches.length)
							? isListRecord(r)
								? "List pairing is ambiguous. Rename the Lists to distinguish them, then retry."
								: isContentRecord(r)
									? "Content pairing is ambiguous. Choose a matching record before retrying."
									: "Confirm whether these Watches are the same viewing."
							: null),
			});
			if (creations.length >= 500) await flush();
			if (match) usedLocal.add(match.key);
		}
		for (const l of newLocal) {
			if (usedLocal.has(l.key)) continue;
			if (
				(pendingByMedia.get(mediaKey(l)) ?? []).some(
					(e) =>
						e.pending &&
						(e.pending as { direction?: string }).direction === "pull" &&
						equivalent(
							readRecord((e.pending as { desired?: unknown }).desired),
							l,
						),
				)
			)
				continue;
			const near = candidates(l, remoteByMedia.get(mediaKey(l)) ?? []);
			creations.push({
				connectionId: c.id,
				kind: l.kind,
				localKey: l.key,
				localBase: json(l),
				eligible: enabled(c, l) && (c.initialised || c.historyScope === "all"),
				issue:
					near.length &&
					(l.kind === "watch" || isListRecord(l) || isContentRecord(l))
						? isListRecord(l)
							? "List pairing is ambiguous. Rename the Lists to distinguish them, then retry."
							: isContentRecord(l)
								? "Content pairing is ambiguous. Choose a matching record before retrying."
								: "Confirm whether these Watches are the same viewing."
						: null,
			});
			if (creations.length >= 500) await flush();
		}
		await flush();
	}
	async issues(userDid: string, query: SyncIssuesQueryDto) {
		const c = await this.requireConnection(userDid);
		const where: Prisma.IntegrationEntryWhereInput = {
			connectionId: c.id,
			issue: { not: null },
			OR: [{ eligible: true }, { linked: true }],
			ignored: query.view === "ignored",
		};
		const total = await this.prisma.integrationEntry.count({ where });
		const pagination = getPaginationMeta(
			total,
			query.page ?? 1,
			query.pageSize ?? 20,
		);
		if (!total) return { ...pagination, items: [] };
		const entries = await this.prisma.integrationEntry.findMany({
			where,
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
			skip: (pagination.page - 1) * pagination.pageSize,
			take: pagination.pageSize,
		});
		const page = { ...pagination, items: entries };
		const kinds = new Set(
			page.items.map((entry) => entry.kind as SyncRecord["kind"]),
		);
		const local = await this.local.snapshot(
			userDid,
			{
				lists: c.lists && kinds.has("list"),
				watchlist: c.watchlist && kinds.has("watchlist"),
				favorites: c.favorites && kinds.has("favorites"),
				notes: c.notes && kinds.has("note"),
				library: c.library && kinds.has("library"),
				reviews: c.reviews && kinds.has("review"),
			},
			kinds,
		);
		const remote = records(c.remoteSnapshot);
		// Most pages need no title mappings. If needed, read only mapping payloads,
		// rather than materializing every issue and both of its full baselines.
		const pageRemoteKeys = new Set(entries.map((e) => e.remoteKey));
		const mappings = remote.some(
			(r) => pageRemoteKeys.has(r.key) && !isListRecord(r) && !r.mediaId,
		)
			? await this.prisma.integrationEntry.findMany({
					where,
					orderBy: { createdAt: "asc" },
					select: { remoteBase: true },
				})
			: entries;
		const mapped = new Map(
			applyMappings(remote, mappings).map((r) => [r.key, r]),
		);
		const localByKey = new Map(local.map((r) => [r.key, r]));
		return {
			...page,
			items: page.items.map((e) => {
				const l = localByKey.get(e.localKey ?? "") ?? null;
				const r = mapped.get(e.remoteKey ?? "") ?? null;
				const source =
					l ?? r ?? readRecord(e.localBase) ?? readRecord(e.remoteBase);
				const uncertain = unconfirmedCreate(e);
				return {
					recovery: r?.unreadable
						? ("retry" as const)
						: uncertain
							? ("verify" as const)
							: (l && r) || e.linked || e.issue === SOURCE_CHANGED
								? ("choose" as const)
								: ("retry" as const),
					traktState: r
						? ("present" as const)
						: uncertain
							? ("unknown" as const)
							: ("missing" as const),
					id: e.id,
					kind: e.kind,
					issue: e.issue ?? "",
					ignored: e.ignored,
					opnshelf: display(l),
					trakt: display(r),
					candidates:
						source && !isListRecord(source) && (!e.linked || (l && !r))
							? (e.linked
									? remote.filter((v) => mediaKey(v) === mediaKey(source))
									: candidates(source, l ? remote : local)
								).flatMap((v) => {
									const item = display(v);
									return item ? [item] : [];
								})
							: [],
				};
			}),
		};
	}
	async resolve(userDid: string, id: string, dto: SyncResolveDto) {
		const c = await this.requireConnection(userDid);
		await this.locked(c, async () => {
			const entry = await this.prisma.integrationEntry.findFirst({
				where: { id, connectionId: c.id },
			});
			if (!entry) throw new NotFoundException("Sync item not found.");
			if (
				(!entry.eligible && !entry.linked) ||
				(c.historyScope === "future" &&
					entry.kind === "watch" &&
					entry.issue === "Choose which watch date to keep.")
			)
				throw new BadRequestException(
					"This existing item is outside your sync scope.",
				);
			if (
				["opnshelf", "trakt"].includes(dto.action) &&
				records(c.remoteSnapshot).some(
					(r) => r.key === entry.remoteKey && r.unreadable,
				)
			)
				throw new BadRequestException(
					"Trakt could not read this List. Retry in Needs attention before choosing a version.",
				);
			const resolvingUnconfirmed =
				unconfirmedCreate(entry) && ["trakt", "opnshelf"].includes(dto.action);
			if (resolvingUnconfirmed && !dto.confirmedTraktMissing)
				throw new BadRequestException(
					"Check Trakt before replacing an unconfirmed transfer.",
				);
			if (resolvingUnconfirmed) {
				// Recheck before discarding the original intent: it may have completed
				// since the User checked Trakt or opened the confirmation.
				if (c.lastError && c.nextRunAt > new Date())
					throw new BadRequestException(
						"Wait for the scheduled Trakt retry before resolving this transfer.",
					);
				const desired = readRecord(
					(entry.pending as { desired?: unknown }).desired,
				);
				const remote = await this.api.snapshot(await this.token(c), c);
				const peers = await this.prisma.integrationEntry.findMany({
					where: {
						connectionId: c.id,
						id: { not: entry.id },
						remoteKey: { not: null },
					},
					select: { remoteKey: true },
				});
				if (
					desired &&
					remote.some(
						(record) =>
							!peers.some((peer) => peer.remoteKey === record.key) &&
							(equivalent(desired, record) ||
								(isListRecord(desired) &&
									record.kind === desired.kind &&
									record.title === desired.title)),
					)
				)
					throw new BadRequestException(
						"Trakt has a possible copy. Check again to reconcile it before choosing a version.",
					);
			}
			if (
				dto.allRatings &&
				(entry.kind !== "rating" || !["trakt", "opnshelf"].includes(dto.action))
			)
				throw new BadRequestException(
					"Bulk resolution is only available for Rating conflicts.",
				);
			if (
				isListRecord(entry) &&
				["match", "link", "separate"].includes(dto.action)
			)
				throw new BadRequestException(
					"Choose a List version, retry, or ignore this List.",
				);
			if (dto.action === "match") {
				const r = readRecord(entry.remoteBase);
				if (!r || !dto.mediaId)
					throw new BadRequestException("Choose a TMDB title.");
				await this.local.validateMatch(r, dto.mediaId);
				const peers = await this.prisma.integrationEntry.findMany({
					where: { connectionId: c.id },
				});
				for (const peer of peers) {
					const p = readRecord(peer.remoteBase);
					if (p && sameTraktTitle(r, p))
						await this.prisma.integrationEntry.update({
							select: { id: true },
							where: { id: peer.id },
							data: {
								remoteBase: json({ ...p, mediaId: dto.mediaId }),
								...(peer.eligible || peer.linked
									? { issue: null, eligible: true }
									: {}),
							},
						});
				}
			} else if (dto.action === "link") {
				const other = await this.prisma.integrationEntry.findFirst({
					where: {
						connectionId: c.id,
						...(entry.localKey
							? { remoteKey: dto.candidateKey }
							: { localKey: dto.candidateKey }),
					},
				});
				if (
					!other ||
					other.id === entry.id ||
					other.linked ||
					(other.localKey && other.remoteKey) ||
					(entry.linked &&
						records(c.remoteSnapshot).some((r) => r.key === entry.remoteKey)) ||
					!dto.candidateKey
				)
					throw new BadRequestException("Choose an unlinked candidate.");
				const l = readRecord(entry.localBase) ?? readRecord(other.localBase);
				const r = entry.linked
					? readRecord(other.remoteBase)
					: (readRecord(entry.remoteBase) ?? readRecord(other.remoteBase));
				if (!l || !r || mediaKey(l) !== mediaKey(r))
					throw new BadRequestException(
						"These records describe different titles.",
					);
				await this.prisma.$transaction(async (tx) => {
					await tx.integrationEntry.delete({ where: { id: other.id } });
					await tx.integrationEntry.update({
						where: { id },
						data: {
							localKey: l.key,
							remoteKey: r.key,
							localBase: json(l),
							remoteBase: json(r),
							linked: true,
							eligible: true,
							issue:
								equivalent(l, r) ||
								(l.kind === "watch" && c.historyScope === "future")
									? null
									: isContentRecord(l)
										? "Choose which version to keep."
										: "Choose which watch date to keep.",
							resolution: null,
							pending: Prisma.DbNull,
						},
					});
				});
			} else {
				await this.prisma.integrationEntry.updateMany({
					where: dto.allRatings
						? {
								connectionId: c.id,
								kind: "rating",
								issue:
									"Both services have different Ratings. Choose which to use.",
								ignored: false,
							}
						: { id },
					data:
						dto.action === "ignore"
							? { ignored: true }
							: dto.action === "undo"
								? { ignored: false }
								: {
										issue: null,
										...(dto.action === "trakt" || dto.action === "opnshelf"
											? { pending: Prisma.DbNull }
											: {}),
										ignored: false,
										eligible: true,
										resolution: ["trakt", "opnshelf", "separate"].includes(
											dto.action,
										)
											? dto.action
											: null,
									},
				});
			}
			await this.prisma.integrationConnection.update({
				select: { id: true },
				where: { id: c.id },
				data: { nextRunAt: new Date(), remoteReadAt: null },
			});
		});
		return this.status(userDid);
	}
	async matches(userDid: string, id: string, query: string) {
		const c = await this.requireConnection(userDid);
		const entry = await this.prisma.integrationEntry.findFirst({
			where: { id, connectionId: c.id },
		});
		const record = readRecord(entry?.remoteBase);
		if (!record) throw new NotFoundException("Sync item not found.");
		return this.local.matches(
			record,
			(query?.trim() || record.title).slice(0, 200),
		);
	}
	async tick() {
		if (this.busy || !this.configured) return;
		this.busy = true;
		try {
			const c = await this.prisma.integrationConnection.findFirst({
				where: {
					provider: PROVIDER,
					status: "active",
					nextRunAt: { lte: new Date() },
					OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
				},
				orderBy: { nextRunAt: "asc" },
			});
			if (!c) return;
			await this.locked(c, async (lease) => {
				try {
					await this.process(c, lease);
				} catch (error) {
					if (error instanceof WatchAccountBusyError) {
						await this.prisma.integrationConnection.update({
							select: { id: true },
							where: { id: c.id },
							data: { nextRunAt: new Date(Date.now() + 5000) },
						});
						return;
					}
					await this.prisma.integrationConnection.update({
						select: { id: true },
						where: { id: c.id },
						data: {
							lastError:
								error instanceof TraktSyncError
									? error.message
									: "Sync could not finish. Your data is retained; retry or reconnect if needed.",
							...(error instanceof TraktSyncError && error.status === 401
								? { status: "reconnect" }
								: {}),
							nextRunAt: new Date(
								Date.now() +
									(error instanceof TraktSyncError ? error.retrySeconds : 60) *
										1000,
							),
							remoteReadAt: null,
						},
					});
				}
			});
		} catch {
			this.logger.warn("Trakt Sync tick could not complete; it will retry.");
		} finally {
			this.busy = false;
		}
	}
	private async publicWatchOperation<T>(
		c: IntegrationConnection,
		work: (signal: AbortSignal, withWrite: WithAccountWrite) => Promise<T>,
		mode: AccountLockMode = "exclusive",
	): Promise<T> {
		return this.watchLocks.run(
			c.userDid,
			async (signal, withWrite) => {
				const deleting = await this.prisma.backgroundJob.findFirst({
					where: {
						userDid: c.userDid,
						type: "account_deletion",
						status: { in: ["queued", "running", "waiting_retry"] },
					},
				});
				if (deleting)
					throw new SyncAccountUnavailable("Account deletion is in progress.");

				const owner = await this.prisma.user.findUniqueOrThrow({
					where: { did: c.userDid },
					select: {
						watchVisibility: true,
						watchPrivacyMigration: { select: { jobId: true } },
					},
				});
				if (
					c.watches &&
					(owner.watchVisibility !== "public" || owner.watchPrivacyMigration)
				)
					throw new SyncAccountUnavailable(
						"Watch sync requires a public Shelf with no privacy change in progress. Disable Watch sync to continue with Ratings.",
					);
				signal.throwIfAborted();
				return watchOperation.run(
					{ did: c.userDid, visibility: "public", signal },
					() => work(signal, withWrite),
				);
			},
			{ mode },
		);
	}

	private async process(c: IntegrationConnection, lease: () => Promise<void>) {
		let remote = records(c.remoteSnapshot);
		// Account reads and transfers share the privacy lock, but slow Trakt
		// pagination must not prevent someone from adding a Watch to their Shelf.
		let local = await this.publicWatchOperation(c, async () => {
			await lease();
			return this.local.snapshot(
				c.userDid,
				c,
				new Set(
					(["watch", "rating"] as const).filter((kind) => enabled(c, { kind })),
				),
			);
		});
		const token = await this.token(c);
		const known = await this.prisma.integrationEntry.findMany({
			where: { connectionId: c.id },
		});
		const knownLocalKeys = new Set(known.map((e) => e.localKey));
		let localByKey = new Map(local.map((r) => [r.key, r]));
		const mayPush =
			c.direction !== "inbound" &&
			(local.some((l) => enabled(c, l) && !knownLocalKeys.has(l.key)) ||
				known.some(
					(e) =>
						!e.ignored &&
						(!e.issue || e.resolution || e.pending) &&
						enabled(c, { kind: e.kind as SyncRecord["kind"] }) &&
						(e.resolution === "opnshelf" ||
							e.pending ||
							fingerprint(localByKey.get(e.localKey ?? "") ?? null) !==
								fingerprint(readRecord(e.localBase)) ||
							(c.direction === "outbound" && e.eligible && !e.linked)),
				));
		if (
			mayPush ||
			!c.remoteReadAt ||
			c.remoteReadAt.getTime() < Date.now() - 15 * 60_000
		) {
			remote = await this.api.snapshot(token, c);
			await lease();
			await this.prisma.integrationConnection.update({
				select: { id: true },
				where: { id: c.id },
				data: {
					remoteSnapshot: remote as unknown as Prisma.InputJsonValue,
					remoteReadAt: new Date(),
				},
			});
			local = await this.publicWatchOperation(c, async () => {
				await lease();
				return this.local.snapshot(
					c.userDid,
					c,
					new Set(
						(["watch", "rating"] as const).filter((kind) =>
							enabled(c, { kind }),
						),
					),
				);
			});
			localByKey = new Map(local.map((r) => [r.key, r]));
		}
		remote = applyMappings(remote, known);
		const remoteByKey = new Map(remote.map((r) => [r.key, r]));
		await lease();
		await this.discover(c, local, remote, known);
		if (!c.initialised) {
			// Initial comparison runs in the worker: large accounts never hold an HTTP request open.
			const unlinked = await this.prisma.integrationEntry.findMany({
				where: { connectionId: c.id, linked: false },
			});
			for (const e of unlinked) {
				if (!enabled(c, { kind: e.kind as SyncRecord["kind"] })) continue;
				await this.prisma.integrationEntry.update({
					select: { id: true },
					where: { id: e.id },
					data: {
						eligible: c.historyScope === "all",
						localBase: json(localByKey.get(e.localKey ?? "") ?? null),
						remoteBase: json(
							remoteByKey.get(e.remoteKey ?? "") ?? readRecord(e.remoteBase),
						),
					},
				});
			}
			await this.prisma.integrationConnection.update({
				select: { id: true },
				where: { id: c.id },
				data: {
					initialised: true,
					nextRunAt: new Date(),
					remaining: 0,
					remainingTotal: 0,
				},
			});
			return;
		}

		const entries = await this.prisma.integrationEntry.findMany({
			where: { connectionId: c.id, ignored: false },
			orderBy: { updatedAt: "asc" },
		});
		const linkedRemoteKeys = new Set(
			entries.filter((e) => e.linked).map((e) => e.remoteKey),
		);
		let writes = 0;
		const startedAt = Date.now();
		// Once this run yields, the rest of the loop only counts what is left,
		// so clients can show how far a large catch-up has come.
		let stopped = false;
		let remaining = 0;
		for (const entry of entries) {
			if (!enabled(c, { kind: entry.kind as SyncRecord["kind"] })) continue;
			const l = localByKey.get(entry.localKey ?? "") ?? null;
			let r = remoteByKey.get(entry.remoteKey ?? "") ?? null;
			const mapped = readRecord(entry.remoteBase);
			if (r && !r.mediaId && mapped?.mediaId)
				r = { ...r, mediaId: mapped.mediaId };
			// Older clients could link excluded Watches and create an initial date
			// choice. Keep both baselines; linking alone must not rewrite history.
			if (
				c.historyScope === "future" &&
				entry.kind === "watch" &&
				entry.linked &&
				entry.issue === "Choose which watch date to keep." &&
				!entry.resolution &&
				!entry.pending
			) {
				await this.prisma.integrationEntry.update({
					select: { id: true },
					where: { id: entry.id },
					data: { issue: null },
				});
				entry.issue = null;
			}
			// Excluded history stays inert, including issues saved before this guard.
			// A later record edit enters scope even when its Watch date is historical.
			if (!entry.eligible && !entry.linked && !entry.pending) {
				// These records have never synced: absence cannot authorize restoring
				// one side or deleting the other. Only edits to present records enter scope.
				if (
					(!l && readRecord(entry.localBase)) ||
					(!r && readRecord(entry.remoteBase))
				)
					continue;
				if (
					fingerprint(l) === fingerprint(readRecord(entry.localBase)) &&
					fingerprint(r) === fingerprint(readRecord(entry.remoteBase))
				)
					continue;
				await this.prisma.integrationEntry.update({
					select: { id: true },
					where: { id: entry.id },
					data: { eligible: true },
				});
				entry.eligible = true;
			}
			// Never turn a failed read into an empty destination, even with a
			// pending transfer or an explicit version choice from an older screen.
			if (r?.unreadable) {
				await this.issue(
					entry.id,
					r.problem ?? "Trakt could not read this List. Retry when ready.",
				);
				continue;
			}
			if (stopped) {
				if (
					(!entry.issue || entry.resolution || entry.pending) &&
					!(r && !r.mediaId && !isListRecord(r)) &&
					(entry.pending ||
						decide(
							{
								linked: entry.linked,
								eligible: entry.eligible,
								localBase: readRecord(entry.localBase),
								remoteBase: readRecord(entry.remoteBase),
							},
							l,
							r,
							c.direction as Direction,
							entry.resolution,
						) !== "none")
				)
					remaining++;
				continue;
			}
			if (
				entry.linked &&
				entry.kind === "watch" &&
				l &&
				!r &&
				!entry.resolution &&
				!entry.pending &&
				remote.some(
					(v) => mediaKey(v) === mediaKey(l) && !linkedRemoteKeys.has(v.key),
				)
			) {
				await this.issue(
					entry.id,
					"Trakt replaced or added a Watch for this title. Confirm whether it is the same viewing before applying the deletion.",
				);
				continue;
			}
			if (entry.issue && !entry.resolution && !entry.pending) continue;
			if (l?.problem || r?.problem || (r && !r.mediaId && !isListRecord(r))) {
				await this.issue(
					entry.id,
					l?.problem ?? r?.problem ?? "Choose a TMDB match for this title.",
				);
				continue;
			}
			const base = {
				linked: entry.linked,
				eligible: entry.eligible,
				localBase: readRecord(entry.localBase),
				remoteBase: readRecord(entry.remoteBase),
			};
			let decision = decide(
				base,
				l,
				r,
				c.direction as Direction,
				entry.resolution,
			);
			if (entry.pending) {
				const pendingDirection = (
					entry.pending as { direction: "push" | "pull" }
				).direction;
				if (
					(c.direction === "inbound" && pendingDirection === "push") ||
					(c.direction === "outbound" && pendingDirection === "pull")
				) {
					await this.issue(
						entry.id,
						"An interrupted transfer conflicts with your new direction. Choose which version to keep.",
					);
					continue;
				}
				decision = pendingDirection;
			}
			if (decision === "conflict") {
				await this.issue(
					entry.id,
					entry.kind === "rating"
						? "Both services have different Ratings. Choose which to use."
						: isListRecord(entry)
							? "Both services changed this List. Choose which version to keep; choosing a missing version deletes the other."
							: "Both services changed this Watch. Choose which version to keep; choosing a missing version deletes the other.",
				);
				continue;
			}
			if (decision === "none") {
				if (
					entry.eligible &&
					l &&
					r &&
					equivalent(l, r) &&
					(!entry.linked ||
						fingerprint(l) !== fingerprint(base.localBase) ||
						fingerprint(r) !== fingerprint(base.remoteBase))
				)
					await this.complete(entry, l, r);
				continue;
			}
			await lease();
			try {
				if (decision === "push" && writes > 0) {
					const sourceTarget = l ?? r ?? base.localBase ?? base.remoteBase;
					const target = sourceTarget && {
						...sourceTarget,
						remoteId: r?.remoteId ?? sourceTarget.remoteId,
					};
					if (!target) throw new Error("Missing transfer target.");
					const current = applyMappings(
						await this.api.readForRecord(token, {
							...target,
							remoteId: r?.remoteId ?? target.remoteId,
						}),
						entries,
					);
					if (
						!sameLocalSnapshot(
							remote.filter((record) => inRemoteScope(record, target, r)),
							current,
						)
					)
						throw new SyncSnapshotChanged(
							"Trakt changed during transfer. Sync will read a fresh snapshot.",
							0,
							5,
						);
				}
				const transferred = await this.publicWatchOperation(
					c,
					async (_signal, withWrite) => {
						const currentMatches = await withWrite(async () => {
							await lease();
							const current = await this.local.snapshot(
								c.userDid,
								{
									lists: entry.kind === "list",
									watchlist: entry.kind === "watchlist",
									favorites: entry.kind === "favorites",
									notes: entry.kind === "note",
									library: entry.kind === "library",
									reviews: entry.kind === "review",
								},
								new Set([entry.kind as SyncRecord["kind"]]),
							);
							// A manual edit can land between transfers. Replan next tick rather
							// than duplicate a new Watch or export/delete a stale local version.
							return sameLocalSnapshot(
								local.filter((record) => record.kind === entry.kind),
								current.filter((record) => record.kind === entry.kind),
							);
						});
						if (!currentMatches) return false;
						// Outbound Trakt I/O holds only the privacy/deletion barrier.
						// Manual Watches can proceed; complete() records the pinned old
						// source so a concurrent edit is reconciled on the next tick.
						await lease();
						const result = await this.transfer(
							c,
							entry,
							l,
							r,
							remote,
							token,
							decision,
						);
						if (decision === "push") {
							remoteByKey.clear();
							for (const record of remote) remoteByKey.set(record.key, record);
							entry.remoteKey = result?.key ?? entry.remoteKey;
							if (entry.remoteKey) linkedRemoteKeys.add(entry.remoteKey);
						}
						if (decision === "pull") {
							local = local.filter((record) => record.key !== l?.key);
							if (l) localByKey.delete(l.key);
							if (result) {
								local.push(result);
								localByKey.set(result.key, result);
							}
						}
						return true;
					},
					decision === "push" ? "shared" : "exclusive",
				);
				if (!transferred) {
					stopped = true;
					remaining++;
					continue;
				}
				writes++;
			} catch (error) {
				if (error instanceof WatchAccountBusyError) {
					stopped = true;
					remaining++;
					continue;
				}
				if (
					error instanceof SyncAccountUnavailable ||
					error instanceof SyncSnapshotChanged ||
					error instanceof ConflictException
				)
					throw error;
				if (
					error instanceof TraktSyncError &&
					error.status >= 400 &&
					error.status < 500 &&
					![408, 499].includes(error.status) &&
					!entry.remoteKey
				)
					await this.prisma.integrationEntry.update({
						select: { id: true },
						where: { id: entry.id },
						data: { pending: Prisma.DbNull },
					});
				if (
					error instanceof TraktSyncError &&
					[401, 429].includes(error.status)
				)
					throw error;
				await this.issue(
					entry.id,
					error instanceof Error &&
						!(error instanceof Prisma.PrismaClientKnownRequestError)
						? error.message
						: "This item could not sync. Retry when ready.",
				);
				// A failed outbound write may have changed Trakt without confirmation.
				if (decision === "push") stopped = true;
			}
			// Bound each catch-up batch; List/content writes can themselves span many
			// records. Watches/Ratings share one full read, with scoped freshness checks.
			if (
				(decision === "push" &&
					(isListRecord(entry) || isContentRecord(entry))) ||
				writes >= 10 ||
				Date.now() - startedAt >= 30_000
			)
				stopped = true;
		}
		await this.prisma.integrationConnection.update({
			select: { id: true },
			where: { id: c.id },
			data: {
				lastSuccessAt: new Date(),
				lastError: null,
				nextRunAt: new Date(Date.now() + 5000),
				remaining,
				// The largest backlog since sync last caught up, so progress
				// only moves forward while new changes trickle in.
				remainingTotal: remaining
					? Math.max(c.remainingTotal, remaining + writes)
					: 0,
			},
		});
	}
	private issue(id: string, issue: string) {
		return this.prisma.integrationEntry.update({
			select: { id: true },
			where: { id },
			data: { issue, resolution: null },
		});
	}
	private complete(
		entry: IntegrationEntry,
		l: SyncRecord | null,
		r: SyncRecord | null,
	) {
		return this.prisma.integrationEntry.update({
			select: { id: true },
			where: { id: entry.id },
			data: {
				localKey: l?.key ?? entry.localKey,
				remoteKey: r?.key ?? entry.remoteKey,
				localBase: json(l),
				remoteBase: json(r),
				linked: true,
				eligible: true,
				issue: null,
				resolution: null,
				pending: Prisma.DbNull,
			},
		});
	}
	private async transfer(
		c: IntegrationConnection,
		entry: IntegrationEntry,
		local: SyncRecord | null,
		remote: SyncRecord | null,
		snapshot: SyncRecord[],
		token: string,
		direction: "push" | "pull",
	) {
		const pending = entry.pending as {
			direction: "push" | "pull";
			desired: SyncRecord | null;
			previous: SyncRecord | null;
			source?: SyncRecord | null;
		} | null;
		let desired = pending
			? readRecord(pending.desired)
			: direction === "push"
				? local
				: remote;
		const previous = pending
			? readRecord(pending.previous)
			: direction === "push"
				? remote
				: local;
		const source = direction === "push" ? local : remote;
		if (
			!pending &&
			desired &&
			previous &&
			isListRecord(desired) &&
			c.direction !== "both"
		) {
			const value = listValue(desired);
			const destination = listValue(previous);
			const baseline = readRecord(
				direction === "push" ? entry.localBase : entry.remoteBase,
			);
			const linkedMembers =
				entry.linked && baseline
					? new Set(listValue(baseline).items.map(memberKey))
					: new Set<string>();
			const sourceMembers = new Set(value.items.map(memberKey));
			const unrelated = destination.items.filter(
				(i) =>
					!sourceMembers.has(memberKey(i)) && !linkedMembers.has(memberKey(i)),
			);
			desired = {
				...desired,
				value: encodeList({ ...value, items: [...value.items, ...unrelated] }),
			};
		}
		if (
			pending &&
			fingerprint(source) !==
				fingerprint(pending.source === undefined ? desired : pending.source)
		) {
			if (!unconfirmedCreate(entry))
				await this.prisma.integrationEntry.update({
					select: { id: true },
					where: { id: entry.id },
					data: { pending: Prisma.DbNull },
				});
			throw new Error(
				unconfirmedCreate(entry)
					? "The source changed while Trakt creation was unconfirmed. Check Trakt before choosing a version."
					: SOURCE_CHANGED,
			);
		}
		if (
			pending &&
			direction === "push" &&
			remote &&
			fingerprint(remote) !== fingerprint(previous) &&
			!equivalent(remote, desired)
		) {
			await this.prisma.integrationEntry.update({
				select: { id: true },
				where: { id: entry.id },
				data: { pending: Prisma.DbNull },
			});
			throw new Error(
				"Trakt changed during an interrupted transfer. Choose which version to keep.",
			);
		}
		if (direction === "push" && desired && isContentRecord(desired)) {
			try {
				validateOutboundContent(desired);
			} catch (error) {
				if (pending)
					await this.prisma.integrationEntry.update({
						select: { id: true },
						where: { id: entry.id },
						data: { pending: Prisma.DbNull },
					});
				throw error;
			}
		}
		if (!pending && desired && isListRecord(desired)) {
			const value = listValue(desired);
			validateList(value);
			if (value.items.some((item) => item.notes.length > 500))
				throw new Error(
					"A List note exceeds Trakt's 500-character limit. No text was truncated.",
				);
		}
		if (!pending)
			await this.prisma.integrationEntry.update({
				select: { id: true },
				where: { id: entry.id },
				data: {
					pending: {
						direction,
						desired,
						previous,
						source,
					} as unknown as Prisma.InputJsonValue,
				},
			});
		if (direction === "pull") {
			if (
				!(isContentRecord(desired ?? previous ?? { kind: "watch" })
					? c.contentPublicationConsent
					: isListRecord(desired ?? previous ?? { kind: "watch" })
						? c.listPublicationConsent
						: c.publicationConsent)
			)
				throw new Error(
					"Acknowledge public publication in sync settings first.",
				);
			if (
				desired &&
				(isListRecord(desired) || isContentRecord(desired)) &&
				!previous &&
				!entry.localKey
			) {
				entry.localKey = `${desired.kind}:${TID.nextStr()}`;
				await this.prisma.integrationEntry.update({
					select: { id: true },
					where: { id: entry.id },
					data: { localKey: entry.localKey },
				});
			}
			const result = await this.local.write(
				c.userDid,
				c.id,
				desired,
				previous,
				entry.localKey?.slice(entry.localKey.indexOf(":") + 1),
			);
			await this.complete(
				entry,
				result,
				desired && isListRecord(desired) ? remote : desired,
			);
			return result;
		}
		const lastLocal = readRecord(entry.localBase);
		if (!desired && lastLocal)
			await this.local.confirmDeleted(c.userDid, lastLocal);
		if (desired?.kind === "watch") {
			const collisions = snapshot.filter(
				(r) => r.key !== previous?.key && equivalent(desired, r),
			);
			if (collisions.length) {
				const used = await this.prisma.integrationEntry.findFirst({
					where: {
						connectionId: c.id,
						remoteKey: { in: collisions.map((r) => r.key) },
						id: { not: entry.id },
					},
				});
				if (pending && collisions.length === 1 && !used) {
					await this.complete(entry, desired, collisions[0]);
					return collisions[0];
				}
				throw new Error(
					"Trakt cannot represent another Watch at this time. Your Opnshelf Watch is preserved.",
				);
			}
		}
		if (unconfirmedCreate(entry) && desired && !remote)
			throw new Error(
				`We couldn’t confirm whether Trakt created this ${desired.kind === "list" ? "List" : desired.kind === "note" ? "Note" : "Review"}. Sync will check again automatically.`,
			);
		if (previous && (desired === null || desired.kind === "watch"))
			await this.api.write(token, previous, true);
		let createdRecord: SyncRecord | undefined;
		if (desired)
			await this.api.write(
				token,
				{
					...desired,
					...(isListRecord(desired) || isContentRecord(desired)
						? { remoteId: remote?.remoteId }
						: remote?.remoteId
							? { remoteId: remote.remoteId }
							: {}),
				},
				false,
				remote,
				async (created) => {
					createdRecord = created;
					entry.remoteKey = created.key;
					await this.prisma.integrationEntry.update({
						select: { id: true },
						where: { id: entry.id },
						data: {
							remoteKey: created.key,
							remoteBase: json(created),
							pending: {
								direction,
								desired,
								previous: created,
								source,
							} as unknown as Prisma.InputJsonValue,
						},
					});
				},
			);
		const sourceTarget = desired ?? previous;
		if (!sourceTarget) throw new Error("Missing transfer target.");
		const target = {
			...sourceTarget,
			remoteId:
				remote?.remoteId ??
				previous?.remoteId ??
				createdRecord?.remoteId ??
				sourceTarget.remoteId,
		};
		const confirmation = applyMappings(
			await this.api.readForRecord(token, target),
			[entry],
		);
		// A scoped read must never replace the full snapshot or advance its freshness.
		const refreshed = [
			...snapshot.filter((r) => !inRemoteScope(r, target, previous)),
			...confirmation,
		];
		const matches = desired
			? confirmation.filter((r) => equivalent(desired, r))
			: [];
		if (desired && matches.length !== 1)
			throw new Error(
				"Trakt has not confirmed this write. Retry to reconcile without inventing another Watch.",
			);
		if (!desired && previous && refreshed.some((r) => r.key === previous.key))
			throw new Error("Trakt has not confirmed this removal yet.");
		await this.prisma.integrationConnection.update({
			select: { id: true },
			where: { id: c.id },
			data: {
				remoteSnapshot: refreshed as unknown as Prisma.InputJsonValue,
			},
		});
		await this.complete(
			entry,
			desired && isListRecord(desired) ? local : desired,
			matches[0] ?? null,
		);
		// Keep subsequent transfers' collision checks aligned with confirmed writes.
		snapshot.length = 0;
		for (const record of refreshed) snapshot.push(record);
		return matches[0] ?? null;
	}
}
