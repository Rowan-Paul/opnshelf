import { expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import type { PrismaService } from "../prisma/prisma.service";
import type { WatchAccountLock } from "../privacy/watch-account-lock";
import { TraktSyncService } from "../trakt-sync/trakt-sync.service";
import type { TraktSyncClient } from "../trakt-sync/trakt-sync.client";
import { PopfeedSyncService } from "../popfeed-sync/popfeed-sync.service";
import type { PopfeedSyncClient } from "../popfeed-sync/popfeed-sync.client";
import type { PopfeedMediaService } from "../popfeed-sync/popfeed-media";
import type { AuthService } from "../auth/auth.service";
import type { LocalSyncRecords } from "./local-records.service";
import type { IntegrationConnection } from "../generated/client";
import type { SyncRecord } from "./reconcile";
import { encodeList } from "./list-value";

const rows: SyncRecord[] = [
	{
		key: "remote-watch",
		kind: "watch",
		mediaType: "movie",
		mediaId: "42",
		season: 0,
		episode: 0,
		title: "Fixture",
		value: "2026-01-01T00:00:00Z",
		problem: "Unsupported Watch history",
	},
	{
		key: "remote-list",
		kind: "list",
		mediaType: "list",
		mediaId: null,
		season: 0,
		episode: 0,
		title: "Fixture",
		value: encodeList({ name: "Fixture", description: "", items: [] }),
		problem: "Unsupported List attachment",
	},
];
function fixture(provider: "trakt" | "popfeed", remote: SyncRecord) {
	const local = { ...remote, key: "local", problem: undefined };
	const entry = {
		id: "entry",
		kind: remote.kind,
		localKey: null,
		remoteKey: remote.key,
		remoteBase: remote,
		localBase: null,
		eligible: true,
		linked: false,
	};
	const peer = {
		id: "peer",
		kind: local.kind,
		localKey: local.key,
		remoteKey: null,
		remoteBase: null,
		localBase: local,
		eligible: true,
		linked: false,
	};
	const prisma = {
		integrationEntry: {
			findMany: vi.fn(async () => []),
			createMany: vi.fn(),
			update: vi.fn(),
			count: vi.fn(async () => 1),
			findFirst: vi.fn(),
		},
		$transaction: vi.fn(),
	};
	const coreLocal = { snapshot: vi.fn(async () => [local]) };
	const config = parseEnvironment({ NODE_ENV: "test" });
	const service =
		provider === "trakt"
			? new TraktSyncService(
					prisma as unknown as PrismaService,
					{} as TraktSyncClient,
					coreLocal as unknown as LocalSyncRecords,
					config,
					{} as WatchAccountLock,
				)
			: new PopfeedSyncService(
					prisma as unknown as PrismaService,
					{} as PopfeedSyncClient,
					coreLocal as unknown as LocalSyncRecords,
					config,
					{} as WatchAccountLock,
					{} as PopfeedMediaService,
					{} as AuthService,
				);
	const c = {
		id: "fixture",
		provider,
		watches: true,
		lists: true,
		initialised: true,
		historyScope: "all",
		remoteSnapshot: [remote],
	} as unknown as IntegrationConnection;
	service["requireConnection"] = vi.fn(async () => c);
	service["locked"] = async (_c, operation) =>
		operation(async () => undefined, "fixture-lease");
	return { service, prisma, local, remote, entry, peer, c };
}
it.each(["trakt", "popfeed"] as const)(
	"%s keeps unsupported records unpaired and retry-only",
	async (provider) => {
		for (const remote of rows) {
			const f = fixture(provider, remote);
			await f.service["discover"](f.c, [f.local], [remote]);
			const created = f.prisma.integrationEntry.createMany.mock.calls.flatMap(
				([arg]) => arg.data,
			);
			expect(created.find((e) => e.remoteKey === remote.key)).toMatchObject({
				linked: false,
				localKey: undefined,
				issue: remote.problem,
			});
			f.prisma.integrationEntry.findMany.mockResolvedValue([f.entry] as never);
			const page = await f.service.listIssues("owner", {});
			expect(page.items[0]).toMatchObject({
				recovery: "retry",
				candidates: [],
			});
			f.prisma.integrationEntry.findFirst
				.mockResolvedValueOnce(f.entry)
				.mockResolvedValueOnce(f.peer);
			await expect(
				f.service.resolveIssue("owner", "entry", {
					action: "link",
					candidateKey: "local",
				}),
			).rejects.toThrow(
				remote.kind === "list"
					? "Choose a List version"
					: "represented faithfully",
			);
			expect(f.prisma.$transaction).not.toHaveBeenCalled();
		}
	},
);
