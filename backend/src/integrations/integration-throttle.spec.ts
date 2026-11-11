import { expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { PopfeedSyncService } from "../popfeed-sync/popfeed-sync.service";
import type { SyncRecord } from "./reconcile";
import { syncPdsFailure } from "./sync-pds";

it.each([429, 503])(
	"stops an inbound backlog on OAuth HTTP %s and schedules a retry without reconnecting",
	async (status) => {
		const remote: SyncRecord[] = [1, 2].map((id) => ({
			key: `watch:${id}`,
			kind: "watch",
			mediaType: "movie",
			mediaId: String(id),
			season: 0,
			episode: 0,
			title: "Fixture",
			value: null,
		}));
		const entries = remote.map((record) => ({
			id: record.key,
			kind: "watch",
			remoteKey: record.key,
			localKey: null,
			remoteBase: record,
			localBase: null,
			eligible: true,
			linked: false,
		}));
		const connection = {
			id: "fixture",
			userDid: "did:plc:fixture",
			provider: "popfeed",
			status: "active",
			direction: "inbound",
			watches: true,
			initialised: true,
			historyScope: "all",
			remoteSnapshot: remote,
			remoteReadAt: new Date(),
			lastError: null,
		};
		const prisma = {
			integrationConnection: {
				findFirst: vi.fn(async () => connection),
				findUniqueOrThrow: vi.fn(async () => connection),
				update: vi.fn(
					async (_args: { data: { status?: string; nextRunAt: Date } }) => ({}),
				),
			},
			integrationEntry: {
				findMany: vi.fn(async () => entries),
				update: vi.fn(),
			},
		};
		const service = new PopfeedSyncService(
			prisma as never,
			{} as never,
			{ snapshot: async () => [] } as never,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as never,
			{} as never,
			{} as never,
		);
		service["locked"] = async (_c, operation) =>
			operation(async () => {}, "lease");
		service["credential"] = async () => ({
			did: connection.userDid,
			pds: "https://pds.fixture.test",
			timeZone: "UTC",
		});
		service["publicWatchOperation"] = async (_c, operation) =>
			operation(new AbortController().signal, async (write) => write());
		service["discover"] = async () => {};
		const transfer = vi.fn<(typeof service)["transfer"]>().mockRejectedValue(
			syncPdsFailure(
				new Error("OAuth resolver failed", {
					cause: {
						response: new Response(null, {
							status,
							headers: { "retry-after": "900" },
						}),
					},
				}),
			),
		);
		service["transfer"] = transfer;
		const started = Date.now();
		await service.tick();
		expect(transfer).toHaveBeenCalledOnce();
		expect(prisma.integrationEntry.update).not.toHaveBeenCalled();
		const update = prisma.integrationConnection.update.mock.calls.at(-1)?.[0];
		expect(update).toMatchObject({
			data: { lastError: expect.any(String), remoteReadAt: null },
		});
		expect(update?.data.status).toBeUndefined();
		expect(update?.data.nextRunAt.getTime()).toBeGreaterThanOrEqual(
			started + 900_000,
		);
	},
);
