import { expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { PopfeedSyncService } from "../popfeed-sync/popfeed-sync.service";
import type { IntegrationEntry } from "../generated/client";
import type { SyncRecord } from "./reconcile";

function gate() {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

it.each(["snapshot", "discovery", "transfer"] as const)(
	"releases a busy Popfeed lease after the current %s so a resolution can retry",
	async (phase) => {
		const entered = gate();
		const resume = gate();
		const record: SyncRecord = {
			key: "remote",
			kind: "watch",
			mediaType: "movie",
			mediaId: "42",
			season: 0,
			episode: 0,
			title: "Fixture",
			value: "2026-01-01T00:00:00Z",
		};
		const entries = [1, 2].map((id) => ({
			id: String(id),
			kind: "watch",
			remoteKey: `${record.key}${id}`,
			localKey: null,
			remoteBase: { ...record, mediaId: String(id), key: `${record.key}${id}` },
			localBase: null,
			linked: false,
			eligible: true,
			pending: null,
		})) as unknown as IntegrationEntry[];
		const remote = entries.map(
			(entry) => entry.remoteBase as unknown as SyncRecord,
		);
		const connection = {
			id: "connection",
			userDid: "did:plc:fixture",
			provider: "popfeed",
			status: "active",
			direction: "inbound",
			watches: true,
			initialised: true,
			historyScope: "all",
			remoteSnapshot: remote,
			remoteReadAt: null,
			lastError: null,
		};
		let held = false;
		const prisma = {
			integrationConnection: {
				findFirst: vi.fn(async () => connection),
				update: vi.fn(async () => ({})),
				updateMany: vi.fn(
					async ({ data }: { data: { leaseId?: string | null } }) => {
						if (data.leaseId === undefined) return { count: held ? 1 : 0 };
						if (data.leaseId === null) {
							held = false;
							return { count: 1 };
						}
						if (held) return { count: 0 };
						held = true;
						return { count: 1 };
					},
				),
			},
			integrationEntry: {
				findMany: vi.fn(async () => entries),
				findFirst: vi.fn(async () => entries[0]),
				updateMany: vi.fn(async () => ({ count: 1 })),
				createMany: vi.fn(),
			},
		};
		const pause = async () => {
			entered.release();
			await resume.promise;
		};
		const service = new PopfeedSyncService(
			prisma as never,
			{
				snapshot: async () => {
					if (phase === "snapshot") await pause();
					return remote;
				},
			} as never,
			{ snapshot: async () => [] } as never,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as never,
			{} as never,
			{} as never,
		);
		service["credential"] = async () => ({
			did: connection.userDid,
			pds: "https://pds.invalid",
			timeZone: "UTC",
		});
		service["publicWatchOperation"] = async (_c, operation) =>
			operation(new AbortController().signal, async (write) => write());
		service.status = vi.fn(async () => ({}) as never);
		if (phase === "discovery") {
			// Pause an actual discovery write, rather than replacing discovery itself.
			entries[0].localKey = null;
			entries[0].linked = false;
			const local = { ...remote[0], key: "local" };
			service["local"].snapshot = async () => [local];
			Object.assign(prisma.integrationEntry, {
				update: vi.fn(async () => {
					await pause();
					return {};
				}),
			});
		}
		const transfer = vi.fn(async () => {
			if (phase === "transfer") await pause();
			return null;
		});
		service["transfer"] = transfer;
		const worker = service.tick();
		await entered.promise;
		await expect(
			service.resolveIssue(connection.userDid, "1", { action: "retry" }),
		).rejects.toMatchObject({ response: { code: "SYNC_BUSY" } });
		expect(held).toBe(true);
		expect(prisma.integrationEntry.updateMany).not.toHaveBeenCalled();
		resume.release();
		await worker;
		expect(held).toBe(false);
		expect(prisma.integrationConnection.update).toHaveBeenLastCalledWith({
			select: { id: true },
			where: { id: connection.id },
			data: { nextRunAt: expect.any(Date) },
		});
		expect(transfer).toHaveBeenCalledTimes(phase === "transfer" ? 1 : 0);
		expect(prisma.integrationConnection.update).not.toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ lastError: expect.anything() }),
			}),
		);
		await expect(
			service.resolveIssue(connection.userDid, "1", { action: "retry" }),
		).resolves.toEqual({});
		expect(prisma.integrationEntry.updateMany).toHaveBeenCalledOnce();
		// Yield is one-shot: later background runs still make progress.
		transfer.mockClear();
		await service.tick();
		expect(held).toBe(false);
		expect(transfer).toHaveBeenCalledTimes(phase === "discovery" ? 1 : 2);
	},
);
