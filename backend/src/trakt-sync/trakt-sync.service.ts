import { WatchAccountLock } from "../privacy/watch-account-lock";
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
	Injectable,
	Logger,
	NotFoundException,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { BackendEnv } from "../config/env.schema";
import {
	Prisma,
	type TraktSyncConnection,
	type TraktSyncEntry,
} from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import { paginateItems } from "../common/pagination";
import { activeTraktImports } from "../users/import/import-activity";
import { LocalSyncRecords } from "./local-records.service";
import {
	candidates,
	decide,
	equivalent,
	fingerprint,
	mediaKey,
	readRecord,
	type Direction,
	type SyncRecord,
} from "./reconcile";
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

const json = (v: SyncRecord | null) =>
	v === null ? Prisma.DbNull : (v as unknown as Prisma.InputJsonValue);
const records = (v: unknown): SyncRecord[] =>
	Array.isArray(v)
		? v.map(readRecord).filter((r): r is SyncRecord => r !== null)
		: [];
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
				displayValue: r.value === null ? "No date" : String(r.value),
			}
		: undefined;
const applyMappings = (
	remote: SyncRecord[],
	entries: Pick<TraktSyncEntry, "remoteBase">[],
) =>
	remote.map((r) => {
		if (r.mediaId) return r;
		const mapped = entries
			.map((e) => readRecord(e.remoteBase))
			.find(
				(p) =>
					p?.mediaId &&
					(r.mediaType === "movie"
						? p.mediaType === "movie" && p.traktId === r.traktId
						: p.mediaType !== "movie" &&
							r.traktParentId &&
							p.traktParentId === r.traktParentId),
			);
		return mapped ? { ...r, mediaId: mapped.mediaId } : r;
	});
const enabled = (c: TraktSyncConnection, r: Pick<SyncRecord, "kind">) =>
	r.kind === "watch" ? c.watches : c.ratings;

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
		return this.prisma.traktSyncConnection.findFirst({
			where: { userDid },
			orderBy: [{ updatedAt: "desc" }],
		});
	}
	async status(userDid: string): Promise<SyncStatusDto> {
		const c = await this.current(userDid);
		const job = await this.prisma.backgroundJob.findFirst({
			where: { userDid, type: "trakt_import" },
			select: { status: true },
		});
		const counts = c
			? await this.prisma.traktSyncEntry.groupBy({
					by: ["ignored"],
					where: { connectionId: c.id, issue: { not: null } },
					_count: true,
				})
			: [];
		return {
			configured: this.configured,
			status:
				c?.status === "active" && !c.initialised
					? "preparing"
					: (c?.status ?? "disconnected"),
			username: c?.username,
			direction: c?.direction ?? "both",
			watches: c?.watches ?? true,
			ratings: c?.ratings ?? true,
			historyScope: c?.historyScope ?? "all",
			publicationConsent: c?.publicationConsent ?? false,
			lastSuccessAt: c?.lastSuccessAt?.toISOString(),
			lastError: c?.lastError ?? undefined,
			needsAttention: counts.find((g) => !g.ignored)?._count ?? 0,
			ignored: counts.find((g) => g.ignored)?._count ?? 0,
			importStatus: job?.status,
		};
	}
	async authorize(userDid: string, platform: "web" | "mobile") {
		if (!this.configured)
			throw new BadRequestException(
				"Trakt Sync is not configured on this server.",
			);
		const verifier = randomBytes(32).toString("base64url");
		const state = randomBytes(32).toString("base64url");
		await this.prisma.authState.create({
			data: {
				key: `trakt:${state}`,
				stateData: this.crypt(JSON.stringify({ userDid, verifier, platform })),
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
		const saved = await this.prisma.authState.findUnique({
			where: { key: `trakt:${state}` },
		});
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
		const data = JSON.parse(this.crypt(saved.stateData, true)) as {
			userDid: string;
			verifier: string;
			platform: string;
		};
		const redirect =
			data.platform === "mobile"
				? "opnshelf://trakt-sync"
				: `${this.config.FRONTEND_URL}/trakt-sync`;
		if (!code) return `${redirect}?connection=cancelled`;
		const token = await this.api.exchange(code, data.verifier);
		try {
			const profile = await this.api.profile(token.access_token);
			const previous = await this.current(data.userDid);
			if (
				previous &&
				previous.status !== "disconnected" &&
				previous.traktUserId !== profile.ids.uuid
			)
				throw new ConflictException(
					"Disconnect the current Trakt account before switching.",
				);
			const existing = await this.prisma.traktSyncConnection.findUnique({
				where: {
					userDid_traktUserId: {
						userDid: data.userDid,
						traktUserId: profile.ids.uuid,
					},
				},
			});
			if (existing)
				await this.locked(existing, async () => {
					await this.prisma.traktSyncConnection.update({
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
				await this.prisma.traktSyncConnection.create({
					data: {
						userDid: data.userDid,
						traktUserId: profile.ids.uuid,
						username: profile.username,
						...this.tokenData(token),
					},
				});
		} catch (error) {
			await this.api.revoke(token.access_token).catch(() => undefined);
			throw error;
		}
		return `${redirect}?connection=connected`;
	}
	private async locked<T>(
		c: TraktSyncConnection,
		operation: (lease: () => Promise<void>) => Promise<T>,
	): Promise<T> {
		const leaseId = randomUUID();
		const claim = await this.prisma.traktSyncConnection.updateMany({
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
			const updated = await this.prisma.traktSyncConnection.updateMany({
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
			await this.prisma.traktSyncConnection.updateMany({
				where: { id: c.id, leaseId },
				data: { leaseId: null, leaseUntil: null },
			});
		}
	}
	private async token(c: TraktSyncConnection) {
		c = await this.prisma.traktSyncConnection.findUniqueOrThrow({
			where: { id: c.id },
		});
		if (!c.accessToken || !c.refreshToken)
			throw new BadRequestException("Connect Trakt first.");
		if (!c.expiresAt || c.expiresAt.getTime() < Date.now() + 60_000) {
			try {
				const fresh = await this.api.refresh(this.crypt(c.refreshToken, true));
				await this.prisma.traktSyncConnection.update({
					where: { id: c.id },
					data: this.tokenData(fresh),
				});
				return fresh.access_token;
			} catch (error) {
				if (
					!(error instanceof TraktSyncError) ||
					![400, 401].includes(error.status)
				)
					throw error;
				await this.prisma.traktSyncConnection.update({
					where: { id: c.id },
					data: {
						status: "reconnect",
						lastError: "Reconnect Trakt to continue syncing.",
					},
				});
				throw new TraktSyncError("Reconnect Trakt to continue syncing.", 401);
			}
		}
		return this.crypt(c.accessToken, true);
	}
	async configure(userDid: string, dto: SyncSettingsDto) {
		if (!dto.watches && !dto.ratings)
			throw new BadRequestException("Choose Watches, Ratings, or both.");
		if (dto.direction !== "outbound" && !dto.publicationConsent)
			throw new BadRequestException(
				"Acknowledge that incoming Watches and Ratings become public.",
			);
		const c = await this.requireConnection(userDid);
		await this.locked(c, async (lease) => {
			const job = await this.prisma.backgroundJob.findFirst({
				where: { userDid, type: "trakt_import" },
			});
			if (job && !["completed", "continued_in_sync"].includes(job.status)) {
				if (!dto.handoffImport)
					throw new ConflictException(
						"Finish your Import first, or explicitly continue it in Trakt Sync.",
					);
				if (activeTraktImports.has(userDid) || job.status === "running")
					throw new ConflictException(
						"Your Import is finishing a page. Try again shortly.",
					);
			}
			await this.token(c);
			await lease();
			const { handoffImport: _handoff, ...settings } = dto;
			if (job && !["completed", "continued_in_sync"].includes(job.status)) {
				if (activeTraktImports.has(userDid))
					throw new ConflictException(
						"Your Import is finishing a page. Try again shortly.",
					);
				const retired = await this.prisma.backgroundJob.updateMany({
					where: {
						id: job.id,
						updatedAt: job.updatedAt,
						status: { not: "running" },
					},
					data: { status: "continued_in_sync" },
				});
				if (!retired.count)
					throw new ConflictException("Your Import changed. Try again.");
			}
			await this.prisma.traktSyncConnection.update({
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
		await this.locked(c, async () => {
			c = await this.prisma.traktSyncConnection.findUniqueOrThrow({
				where: { id: c.id },
			});
			if (action === "disconnect") {
				// Freeze first, even if remote revocation is temporarily unavailable.
				await this.prisma.traktSyncConnection.update({
					where: { id: c.id },
					data: { status: "paused" },
				});
				if (c.accessToken)
					await this.api.revoke(this.crypt(c.accessToken, true));
				await this.prisma.traktSyncConnection.update({
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
				await this.prisma.traktSyncConnection.update({
					where: { id: c.id },
					data: {
						status: action === "pause" ? "paused" : "active",
						nextRunAt: new Date(),
						...(action === "sync" ? { remoteReadAt: null } : {}),
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
	async recoverImport<T>(
		userDid: string,
		operation: () => Promise<T>,
	): Promise<T> {
		const c = await this.requireConnection(userDid);
		return this.publicWatchOperation({ ...c, watches: true }, () =>
			this.recoverImportLocked(c, operation),
		);
	}
	private async recoverImportLocked<T>(
		c: TraktSyncConnection,
		operation: () => Promise<T>,
	): Promise<T> {
		const userDid = c.userDid;
		return this.locked(c, async (lease) => {
			if (!c.publicationConsent)
				throw new BadRequestException(
					"Confirm publication in Trakt Sync settings first.",
				);
			const token = await this.token(c);
			const remote = await this.api.snapshot(token);
			const before = await this.local.snapshot(userDid);
			const result = await operation();
			await lease();
			const after = await this.local.snapshot(userDid);
			const job = await this.prisma.backgroundJob.findFirst({
				where: { userDid, type: "trakt_import" },
				include: { traktMatches: true },
			});
			for (const r of remote) {
				const mapping = job?.traktMatches.find(
					(m) =>
						m.matchKey ===
						`${r.mediaType === "movie" ? "movie" : "show"}:${r.traktParentId}`,
				);
				if (mapping && !r.mediaId) r.mediaId = mapping.tmdbId;
			}
			for (const l of after.filter(
				(r) => !before.some((b) => b.key === r.key),
			)) {
				const matches = remote.filter((r) => equivalent(l, r));
				const r = matches.length === 1 ? matches[0] : null;
				const entry = r
					? await this.prisma.traktSyncEntry.findUnique({
							where: {
								connectionId_remoteKey: {
									connectionId: c.id,
									remoteKey: r.key,
								},
							},
						})
					: null;
				if (entry && !entry.localKey) await this.complete(entry, l, r);
				else
					await this.prisma.traktSyncEntry.create({
						data: {
							connectionId: c.id,
							kind: l.kind,
							localKey: l.key,
							remoteKey: entry ? null : r?.key,
							localBase: json(l),
							remoteBase: json(r),
							eligible: true,
							linked: Boolean(r && !entry),
							issue:
								!r || entry
									? "Confirm whether this recovered Watch matches Trakt history."
									: null,
						},
					});
			}
			await this.prisma.traktSyncConnection.update({
				where: { id: c.id },
				data: {
					remoteSnapshot: remote as unknown as Prisma.InputJsonValue,
					nextRunAt: new Date(),
					remoteReadAt: new Date(),
				},
			});
			return result;
		});
	}
	private async discover(
		c: TraktSyncConnection,
		local: SyncRecord[],
		remote: SyncRecord[],
	) {
		const entries = await this.prisma.traktSyncEntry.findMany({
			where: { connectionId: c.id },
		});
		// Adopt a completed legacy recovery even if the process died before saving
		// its link. Never create a second PDS Watch over the recovered viewing.
		for (const e of entries) {
			if (e.localKey || e.linked || e.pending) continue;
			const r = remote.find((v) => v.key === e.remoteKey);
			if (!r || r.value === null) continue;
			const matches = local.filter(
				(l) => !entries.some((v) => v.localKey === l.key) && equivalent(l, r),
			);
			if (
				matches.length !== 1 ||
				remote.filter((v) => equivalent(v, matches[0])).length !== 1
			)
				continue;
			const l = matches[0];
			await this.prisma.traktSyncEntry.update({
				where: { id: e.id },
				data: {
					localKey: l.key,
					localBase: json(l),
					linked: e.eligible,
					issue: null,
				},
			});
			e.localKey = l.key;
			e.linked = e.eligible;
		}
		const usedLocal = new Set(entries.map((e) => e.localKey));
		const usedRemote = new Set(entries.map((e) => e.remoteKey));
		const newLocal = local.filter((r) => !usedLocal.has(r.key));
		const newRemote = remote.filter((r) => !usedRemote.has(r.key));
		for (const r of newRemote) {
			// A write may have reached Trakt before its acknowledgement was lost.
			// Let that durable intent claim the result before ordinary discovery.
			if (
				entries.some(
					(e) =>
						e.pending &&
						(e.pending as { direction?: string }).direction === "push" &&
						equivalent(
							readRecord((e.pending as { desired?: unknown }).desired),
							r,
						),
				)
			)
				continue;
			const possibleReplacement =
				r.kind === "watch" &&
				entries.some(
					(e) =>
						e.linked &&
						e.remoteKey &&
						!remote.some((v) => v.key === e.remoteKey) &&
						mediaKey(readRecord(e.remoteBase) ?? r) === mediaKey(r),
				);
			const matches = r.mediaId
				? candidates(
						r,
						newLocal.filter((l) => !usedLocal.has(l.key)),
					)
				: [];
			const match =
				matches.length === 1 &&
				(r.kind === "rating" ||
					(r.value !== null &&
						matches[0].value !== null &&
						equivalent(matches[0], r) &&
						candidates(matches[0], newRemote).length === 1))
					? matches[0]
					: null;
			const eligible =
				enabled(c, r) && (c.initialised || c.historyScope === "all");
			await this.prisma.traktSyncEntry.create({
				data: {
					connectionId: c.id,
					kind: r.kind,
					remoteKey: r.key,
					localKey: match?.key,
					localBase: json(match),
					remoteBase: json(r),
					linked: Boolean(eligible && match && equivalent(match, r)),
					eligible,
					issue: !r.mediaId
						? "Choose a TMDB match for this title."
						: possibleReplacement || (!match && matches.length)
							? "Confirm whether these Watches are the same viewing."
							: null,
				},
			});
			if (match) usedLocal.add(match.key);
		}
		for (const l of newLocal) {
			if (usedLocal.has(l.key)) continue;
			if (
				entries.some(
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
			const near = candidates(l, remote);
			await this.prisma.traktSyncEntry.create({
				data: {
					connectionId: c.id,
					kind: l.kind,
					localKey: l.key,
					localBase: json(l),
					eligible:
						enabled(c, l) && (c.initialised || c.historyScope === "all"),
					issue:
						l.kind === "watch" && near.length
							? "Confirm whether these Watches are the same viewing."
							: null,
				},
			});
		}
	}
	async issues(userDid: string, query: SyncIssuesQueryDto) {
		const c = await this.requireConnection(userDid);
		const local = await this.local.snapshot(userDid);
		const remote = records(c.remoteSnapshot);
		const entries = await this.prisma.traktSyncEntry.findMany({
			where: {
				connectionId: c.id,
				issue: { not: null },
				ignored: query.view === "ignored",
			},
			orderBy: { createdAt: "asc" },
		});
		return paginateItems(
			entries.map((e) => {
				const l = local.find((r) => r.key === e.localKey) ?? null;
				const r =
					applyMappings(remote, entries).find((r) => r.key === e.remoteKey) ??
					null;
				const source =
					l ?? r ?? readRecord(e.localBase) ?? readRecord(e.remoteBase);
				return {
					id: e.id,
					kind: e.kind,
					issue: e.issue ?? "",
					ignored: e.ignored,
					opnshelf: display(l),
					trakt: display(r),
					candidates:
						source && (!e.linked || (l && !r))
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
			query.page ?? 1,
			query.pageSize ?? 20,
		);
	}
	async resolve(userDid: string, id: string, dto: SyncResolveDto) {
		const c = await this.requireConnection(userDid);
		await this.locked(c, async () => {
			const entry = await this.prisma.traktSyncEntry.findFirst({
				where: { id, connectionId: c.id },
			});
			if (!entry) throw new NotFoundException("Sync item not found.");
			if (
				dto.allRatings &&
				(entry.kind !== "rating" || !["trakt", "opnshelf"].includes(dto.action))
			)
				throw new BadRequestException(
					"Bulk resolution is only available for Rating conflicts.",
				);
			if (dto.action === "match") {
				const r = readRecord(entry.remoteBase);
				if (!r || !dto.mediaId)
					throw new BadRequestException("Choose a TMDB title.");
				await this.local.validateMatch(r, dto.mediaId);
				const peers = await this.prisma.traktSyncEntry.findMany({
					where: { connectionId: c.id },
				});
				for (const peer of peers) {
					const p = readRecord(peer.remoteBase);
					if (
						p &&
						(r.mediaType === "movie"
							? p.traktId === r.traktId && p.mediaType === "movie"
							: r.traktParentId && p.traktParentId === r.traktParentId)
					)
						await this.prisma.traktSyncEntry.update({
							where: { id: peer.id },
							data: {
								remoteBase: json({ ...p, mediaId: dto.mediaId }),
								issue: null,
								eligible: true,
							},
						});
				}
			} else if (dto.action === "link") {
				const other = await this.prisma.traktSyncEntry.findFirst({
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
					await tx.traktSyncEntry.delete({ where: { id: other.id } });
					await tx.traktSyncEntry.update({
						where: { id },
						data: {
							localKey: l.key,
							remoteKey: r.key,
							localBase: json(l),
							remoteBase: json(r),
							linked: true,
							eligible: true,
							issue: equivalent(l, r)
								? null
								: "Choose which watch date to keep.",
							resolution: null,
							pending: Prisma.DbNull,
						},
					});
				});
			} else {
				await this.prisma.traktSyncEntry.updateMany({
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
			await this.prisma.traktSyncConnection.update({
				where: { id: c.id },
				data: { nextRunAt: new Date(), remoteReadAt: null },
			});
		});
		return this.status(userDid);
	}
	async matches(userDid: string, id: string, query: string) {
		const c = await this.requireConnection(userDid);
		const entry = await this.prisma.traktSyncEntry.findFirst({
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
			const c = await this.prisma.traktSyncConnection.findFirst({
				where: {
					status: "active",
					nextRunAt: { lte: new Date() },
					OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
				},
				orderBy: { nextRunAt: "asc" },
			});
			if (!c) return;
			await this.locked(c, async (lease) => {
				try {
					await this.publicWatchOperation(c, async (signal) =>
						this.process(c, async () => {
							signal.throwIfAborted();
							await lease();
						}),
					);
				} catch (error) {
					await this.prisma.traktSyncConnection.update({
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
		c: TraktSyncConnection,
		work: (signal: AbortSignal) => Promise<T>,
	): Promise<T> {
		return this.watchLocks.run(c.userDid, async (signal) => {
			const deleting = await this.prisma.backgroundJob.findFirst({
				where: {
					userDid: c.userDid,
					type: "account_deletion",
					status: { in: ["queued", "running", "waiting_retry"] },
				},
			});
			if (deleting)
				throw new TraktSyncError("Account deletion is in progress.");

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
				throw new TraktSyncError(
					"Watch sync requires a public Shelf with no privacy change in progress. Disable Watch sync to continue with Ratings.",
				);
			signal.throwIfAborted();
			return watchOperation.run(
				{ did: c.userDid, visibility: "public", signal },
				() => work(signal),
			);
		});
	}

	private async process(c: TraktSyncConnection, lease: () => Promise<void>) {
		const token = await this.token(c);
		let remote = records(c.remoteSnapshot);
		const local = await this.local.snapshot(c.userDid);
		const known = await this.prisma.traktSyncEntry.findMany({
			where: { connectionId: c.id },
		});
		const mayPush =
			c.direction !== "inbound" &&
			(local.some(
				(l) => enabled(c, l) && !known.some((e) => e.localKey === l.key),
			) ||
				known.some(
					(e) =>
						!e.ignored &&
						(!e.issue || e.resolution || e.pending) &&
						enabled(c, { kind: e.kind as "watch" | "rating" }) &&
						(e.resolution === "opnshelf" ||
							e.pending ||
							fingerprint(local.find((l) => l.key === e.localKey) ?? null) !==
								fingerprint(readRecord(e.localBase)) ||
							(c.direction === "outbound" && e.eligible && !e.linked)),
				));
		if (
			mayPush ||
			!c.remoteReadAt ||
			c.remoteReadAt.getTime() < Date.now() - 15 * 60_000
		) {
			remote = await this.api.snapshot(token);
			await this.prisma.traktSyncConnection.update({
				where: { id: c.id },
				data: {
					remoteSnapshot: remote as unknown as Prisma.InputJsonValue,
					remoteReadAt: new Date(),
				},
			});
		}
		remote = applyMappings(remote, known);
		await lease();
		await this.discover(c, local, remote);
		if (!c.initialised) {
			// Initial comparison runs in the worker: large accounts never hold an HTTP request open.
			const unlinked = await this.prisma.traktSyncEntry.findMany({
				where: { connectionId: c.id, linked: false },
			});
			for (const e of unlinked) {
				if (!enabled(c, { kind: e.kind as "watch" | "rating" })) continue;
				await this.prisma.traktSyncEntry.update({
					where: { id: e.id },
					data: {
						eligible: c.historyScope === "all",
						localBase: json(local.find((r) => r.key === e.localKey) ?? null),
						remoteBase: json(
							remote.find((r) => r.key === e.remoteKey) ??
								readRecord(e.remoteBase),
						),
					},
				});
			}
			await this.prisma.traktSyncConnection.update({
				where: { id: c.id },
				data: { initialised: true, nextRunAt: new Date() },
			});
			return;
		}

		const entries = await this.prisma.traktSyncEntry.findMany({
			where: { connectionId: c.id, ignored: false },
			orderBy: { updatedAt: "asc" },
		});
		let writes = 0;
		for (const entry of entries) {
			if (!enabled(c, { kind: entry.kind as "watch" | "rating" })) continue;
			const l = local.find((r) => r.key === entry.localKey) ?? null;
			let r = remote.find((r) => r.key === entry.remoteKey) ?? null;
			const mapped = readRecord(entry.remoteBase);
			if (r && !r.mediaId && mapped?.mediaId)
				r = { ...r, mediaId: mapped.mediaId };
			if (
				entry.linked &&
				entry.kind === "watch" &&
				l &&
				!r &&
				!entry.resolution &&
				!entry.pending &&
				remote.some(
					(v) =>
						mediaKey(v) === mediaKey(l) &&
						!entries.some((e) => e.remoteKey === v.key && e.linked),
				)
			) {
				await this.issue(
					entry.id,
					"Trakt replaced or added a Watch for this title. Confirm whether it is the same viewing before applying the deletion.",
				);
				continue;
			}
			if (entry.issue && !entry.resolution && !entry.pending) continue;
			if (r && !r.mediaId) {
				await this.issue(entry.id, "Choose a TMDB match for this title.");
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
				await this.transfer(c, entry, l, r, remote, token, decision);
				writes++;
			} catch (error) {
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
			}
			// Inbound items have independent stable keys. Yield after outbound work,
			// whose readback can affect collision checks for another viewing.
			if (decision === "push" || writes >= 10) break;
		}
		await this.prisma.traktSyncConnection.update({
			where: { id: c.id },
			data: {
				lastSuccessAt: new Date(),
				lastError: null,
				nextRunAt: new Date(Date.now() + 5000),
			},
		});
	}
	private issue(id: string, issue: string) {
		return this.prisma.traktSyncEntry.update({
			where: { id },
			data: { issue, resolution: null },
		});
	}
	private complete(
		entry: TraktSyncEntry,
		l: SyncRecord | null,
		r: SyncRecord | null,
	) {
		return this.prisma.traktSyncEntry.update({
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
		c: TraktSyncConnection,
		entry: TraktSyncEntry,
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
		} | null;
		const desired = pending
			? readRecord(pending.desired)
			: direction === "push"
				? local
				: remote;
		const previous = pending
			? readRecord(pending.previous)
			: direction === "push"
				? remote
				: local;
		if (
			pending &&
			fingerprint(direction === "push" ? local : remote) !==
				fingerprint(desired)
		) {
			await this.prisma.traktSyncEntry.update({
				where: { id: entry.id },
				data: { pending: Prisma.DbNull },
			});
			throw new Error(
				"The source changed during an interrupted transfer. Choose which version to keep.",
			);
		}
		if (
			pending &&
			direction === "push" &&
			remote &&
			fingerprint(remote) !== fingerprint(previous) &&
			!equivalent(remote, desired)
		) {
			await this.prisma.traktSyncEntry.update({
				where: { id: entry.id },
				data: { pending: Prisma.DbNull },
			});
			throw new Error(
				"Trakt changed during an interrupted transfer. Choose which version to keep.",
			);
		}
		if (!pending)
			await this.prisma.traktSyncEntry.update({
				where: { id: entry.id },
				data: {
					pending: {
						direction,
						desired,
						previous,
					} as unknown as Prisma.InputJsonValue,
				},
			});
		if (direction === "pull") {
			if (!c.publicationConsent)
				throw new Error(
					"Acknowledge public publication in sync settings first.",
				);
			const result = await this.local.write(
				c.userDid,
				c.id,
				desired,
				previous,
				entry.localKey?.slice(entry.localKey.indexOf(":") + 1),
			);
			await this.complete(entry, result, desired);
			return;
		}
		const lastLocal = readRecord(entry.localBase);
		if (!desired && lastLocal)
			await this.local.confirmDeleted(c.userDid, lastLocal);
		if (desired?.kind === "watch") {
			const collisions = snapshot.filter(
				(r) => r.key !== previous?.key && equivalent(desired, r),
			);
			if (collisions.length) {
				const used = await this.prisma.traktSyncEntry.findFirst({
					where: {
						connectionId: c.id,
						remoteKey: { in: collisions.map((r) => r.key) },
						id: { not: entry.id },
					},
				});
				if (pending && collisions.length === 1 && !used) {
					await this.complete(entry, desired, collisions[0]);
					return;
				}
				throw new Error(
					"Trakt cannot represent another Watch at this time. Your Opnshelf Watch is preserved.",
				);
			}
		}
		if (previous && (desired === null || desired.kind === "watch"))
			await this.api.write(token, previous, true);
		if (desired)
			await this.api.write(token, {
				...desired,
				...(remote?.traktId ? { traktId: remote.traktId } : {}),
			});
		const refreshed = applyMappings(await this.api.snapshot(token), [entry]);
		const matches = desired
			? refreshed.filter((r) => equivalent(desired, r))
			: [];
		if (desired && matches.length !== 1)
			throw new Error(
				"Trakt has not confirmed this write. Retry to reconcile without inventing another Watch.",
			);
		if (!desired && previous && refreshed.some((r) => r.key === previous.key))
			throw new Error("Trakt has not confirmed this removal yet.");
		await this.prisma.traktSyncConnection.update({
			where: { id: c.id },
			data: {
				remoteSnapshot: refreshed as unknown as Prisma.InputJsonValue,
				remoteReadAt: new Date(),
			},
		});
		await this.complete(entry, desired, matches[0] ?? null);
	}
}
