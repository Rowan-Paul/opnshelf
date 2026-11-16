import { expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { PopfeedSyncService } from "../popfeed-sync/popfeed-sync.service";

it("reads the local snapshot under the shared barrier so Watch writes are not rejected", async () => {
	const connection = {
		id: "connection",
		userDid: "did:plc:fixture",
		provider: "popfeed",
		status: "active",
		direction: "inbound",
		watches: true,
		initialised: true,
		historyScope: "all",
		remoteSnapshot: [],
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
					if (held && data.leaseId !== null) return { count: 0 };
					held = data.leaseId !== null;
					return { count: 1 };
				},
			),
		},
		integrationEntry: {
			findMany: vi.fn(async () => []),
			updateMany: vi.fn(async () => ({ count: 0 })),
			createMany: vi.fn(),
		},
		backgroundJob: { findFirst: vi.fn(async () => null) },
		user: {
			findUniqueOrThrow: vi.fn(async () => ({
				watchVisibility: "public",
				watchPrivacyMigration: null,
			})),
		},
	};
	const acquisitions: { mode?: string; operationName?: string }[] = [];
	const watchLocks = {
		run: vi.fn(
			async (
				_did: string,
				operation: (
					signal: AbortSignal,
					withWrite: (write: () => Promise<unknown>) => Promise<unknown>,
				) => Promise<unknown>,
				options: { mode?: string; operationName?: string },
			) => {
				acquisitions.push(options);
				return operation(new AbortController().signal, (write) => write());
			},
		),
	};
	const localSnapshot = vi.fn(async () => []);
	const service = new PopfeedSyncService(
		prisma as never,
		{ snapshot: async () => [] } as never,
		{ snapshot: localSnapshot } as never,
		parseEnvironment({ NODE_ENV: "test" }),
		watchLocks as never,
		{} as never,
		{} as never,
	);
	service["credential"] = async () => ({
		did: connection.userDid,
		pds: "https://pds.invalid",
		timeZone: "UTC",
	});
	service.status = vi.fn(async () => ({}) as never);

	await service.tick();

	// Before and after the remote read.
	expect(localSnapshot).toHaveBeenCalledTimes(2);
	expect(acquisitions).toEqual([
		{ mode: "shared", operationName: "popfeed.snapshot" },
		{ mode: "shared", operationName: "popfeed.snapshot" },
	]);
});
