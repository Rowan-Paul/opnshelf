import { expect, it, vi } from "vitest";
import { PopfeedSyncService } from "./popfeed-sync.service";

function fixture(status: string) {
	const userDid = "did:plc:fixture";
	const connection = {
		id: "connection",
		userDid,
		accountId: userDid,
		status,
		username: "old.fixture.test",
		direction: "both",
		historyScope: "all",
		watches: true,
		ratings: true,
		initialised: true,
		publicationConsent: true,
		lastError: "Sign in to Opnshelf again to keep sending changes to Popfeed.",
		failingSince: new Date(0),
		remoteReadAt: new Date(),
		remoteSnapshot: [{ key: "existing-record" }],
		remoteFeed: { cursor: "saved" },
	};
	let held: string | null = null;
	const prisma = {
		user: { findUniqueOrThrow: async () => ({ handle: "new.fixture.test" }) },
		integrationConnection: {
			findFirst: async () => ({ ...connection }),
			findUniqueOrThrow: async () => ({ ...connection }),
			update: vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
				Object.assign(connection, data),
			),
			updateMany: vi.fn(
				async ({
					where,
					data,
				}: {
					where: { OR?: unknown; leaseId?: string };
					data: { leaseId?: string | null };
				}) => {
					if (where.OR) {
						if (held) return { count: 0 };
						held = data.leaseId ?? null;
						return { count: 1 };
					}
					if (where.leaseId !== held) return { count: 0 };
					if (data.leaseId === null) held = null;
					return { count: 1 };
				},
			),
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
	service.status = vi.fn(
		async () =>
			({ status: connection.status, lastError: connection.lastError }) as never,
	);
	return { service, prisma, connection, userDid };
}

it.each(["reconnect", "disconnected"])(
	"recovers a %s connection and allows resuming without losing saved history",
	async (status) => {
		const f = fixture(status);
		const before = structuredClone(f.connection);
		await expect(f.service.connect(f.userDid)).resolves.toMatchObject({
			status: "paused",
			lastError: null,
		});
		expect(f.prisma.integrationConnection.update).toHaveBeenCalledWith({
			select: { id: true },
			where: { id: "connection" },
			data: {
				status: "paused",
				username: "new.fixture.test",
				lastError: null,
				failingSince: null,
				remoteReadAt: null,
			},
		});
		expect(f.connection).toMatchObject({
			direction: before.direction,
			historyScope: before.historyScope,
			remoteSnapshot: before.remoteSnapshot,
			remoteFeed: before.remoteFeed,
			initialised: true,
		});
		await expect(f.service.action(f.userDid, "resume")).resolves.toMatchObject({
			status: "active",
			lastError: null,
		});
	},
);

it.each(["active", "paused"])(
	"leaves an already %s connection unchanged",
	async (status) => {
		const f = fixture(status);
		await f.service.connect(f.userDid);
		expect(f.prisma.integrationConnection.update).not.toHaveBeenCalled();
	},
);

it("does not replace a connection state changed before acquiring the lease", async () => {
	const f = fixture("reconnect");
	f.prisma.integrationConnection.updateMany.mockImplementationOnce(async () => {
		f.connection.status = "active";
		return { count: 1 };
	});
	await f.service.connect(f.userDid);
	expect(f.prisma.integrationConnection.update).not.toHaveBeenCalled();
	expect(f.connection.status).toBe("active");
});
