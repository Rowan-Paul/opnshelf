import { expect, it, vi } from "vitest";
import { PopfeedSyncService } from "../popfeed-sync/popfeed-sync.service";

function fixture(ids: string[], reschedule = true) {
	const due = new Set(ids);
	const prisma = {
		integrationConnection: {
			findFirst: vi.fn(
				async ({ where }: { where: { id?: { notIn: string[] } } }) => {
					const id = [...due].find((d) => !where.id?.notIn.includes(d));
					return id ? { id, accountId: id, userDid: id } : null;
				},
			),
			updateMany: vi.fn(async () => ({ count: 1 })),
			update: vi.fn(async () => ({})),
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
	const process = vi.fn(async (c: { id: string }) => {
		if (reschedule) due.delete(c.id);
	});
	service["process"] = process as never;
	return { service, process };
}

it("runs every due connection in one tick instead of one per timer interval", async () => {
	const f = fixture(["a", "b", "c"]);
	await f.service.tick();
	expect(f.process.mock.calls.map(([c]) => c.id)).toEqual(["a", "b", "c"]);
});

it("runs a connection at most once per tick, even if it is still due afterwards", async () => {
	const f = fixture(["a", "b"], false);
	await f.service.tick();
	expect(f.process.mock.calls.map(([c]) => c.id)).toEqual(["a", "b"]);
});
