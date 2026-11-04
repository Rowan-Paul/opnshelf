import { expect, it, vi } from "vitest";
import { PopfeedSyncService } from "./popfeed-sync.service";

it("distinguishes a busy configure lease from ownership loss and saves after release", async () => {
	let held: string | null = null;
	const update = vi.fn(async () => ({}));
	const connection = { id: "fixture", userDid: "did:plc:fixture" };
	let loseOwnership = false;
	const prisma = {
		integrationConnection: {
			findFirst: vi.fn(async () => connection),
			update,
			updateMany: vi.fn(async ({ where, data }) => {
				if (where.OR) {
					if (held) return { count: 0 };
					held = data.leaseId;
					return { count: 1 };
				}
				if (loseOwnership || where.leaseId !== held) return { count: 0 };
				if (data.leaseId === null) held = null;
				return { count: 1 };
			}),
		},
	};
	const service = new PopfeedSyncService(
		prisma as never,
		{} as never,
		{} as never,
		{ NODE_ENV: "test" } as never,
		{} as never,
		{} as never,
		{} as never,
	);
	service["credential"] = vi.fn(async () => ({}) as never);
	service.status = vi.fn(async () => ({}) as never);
	let release!: () => void;
	let entered!: () => void;
	const started = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const waiting = new Promise<void>((resolve) => {
		release = resolve;
	});
	const worker = service["locked"](connection as never, async () => {
		entered();
		await waiting;
	});
	const settings = {
		direction: "inbound" as const,
		historyScope: "all" as const,
		watches: true,
		ratings: false,
		publicationConsent: true,
	};
	await started;
	try {
		await expect(
			service.configure(connection.userDid, settings),
		).rejects.toMatchObject({
			response: { statusCode: 409, code: "SYNC_BUSY" },
		});
		expect(update).not.toHaveBeenCalled();
	} finally {
		release();
		await worker;
	}
	await service.configure(connection.userDid, settings);
	expect(update).toHaveBeenCalledOnce();
	update.mockClear();
	loseOwnership = true;
	await expect(
		service.configure(connection.userDid, settings),
	).rejects.toMatchObject({
		status: 409,
		response: {
			code: "SYNC_OWNERSHIP_CHANGED",
			message: "Sync ownership changed. Try again.",
		},
	});
	expect(update).not.toHaveBeenCalled();
});
