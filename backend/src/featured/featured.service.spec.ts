import { ConflictException, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeaturedContent } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { FeaturedCatalogService } from "./featured-catalog.service";
import { FeaturedService } from "./featured.service";
import type { PublishFeaturedDto } from "./featured.dto";

const input: PublishFeaturedDto = {
	mediaType: "movie",
	mediaId: 42,
	message: "New trailer",
	expiresAt: "2099-01-01T12:00:00Z",
};
function pick(
	id = "one",
	extra: Partial<FeaturedContent> = {},
): FeaturedContent {
	return {
		id,
		mediaType: "movie",
		mediaId: 42,
		seasonNumber: null,
		title: "Saved title",
		posterPath: "/saved.jpg",
		message: "New trailer",
		sourceUrl: null,
		sourceLabel: null,
		published: true,
		expiresAt: new Date(input.expiresAt),
		position: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		...extra,
	};
}
function setup(active: FeaturedContent[] = []) {
	const model = {
		findMany: vi.fn().mockResolvedValue(active),
		findUnique: vi.fn().mockResolvedValue(active[0] ?? null),
		count: vi.fn().mockResolvedValue(active.length),
		create: vi
			.fn()
			.mockImplementation(({ data }) => Promise.resolve(pick("new", data))),
		update: vi
			.fn()
			.mockImplementation(({ data, where }) =>
				Promise.resolve(pick(where.id, data)),
			),
		updateMany: vi.fn().mockResolvedValue({ count: 1 }),
	};
	const tx = { featuredContent: model, $executeRaw: vi.fn() };
	const prisma = { ...tx, $transaction: vi.fn(async (fn) => fn(tx)) };
	const catalog = {
		resolve: vi
			.fn()
			.mockResolvedValue({ title: "Fresh title", posterPath: "/fresh.jpg" }),
	};
	const service = new FeaturedService(
		prisma as unknown as PrismaService,
		catalog as unknown as FeaturedCatalogService,
	);
	return { model, tx, catalog, service };
}
afterEach(() => vi.useRealTimers());
describe("Featured Content", () => {
	it("bounds public lookup latency during a hanging catalog request", async () => {
		vi.useFakeTimers();
		const { service, catalog } = setup([pick()]);
		catalog.resolve.mockReturnValue(new Promise(() => {}));
		const response = service.selection();
		await vi.advanceTimersByTimeAsync(1500);
		expect((await response).items).toEqual([
			expect.objectContaining({ title: "Saved title" }),
		]);
	});
	it("publishes verified catalog metadata after taking the editorial lock", async () => {
		const { service, model, tx } = setup();
		expect(await service.publish(input)).toMatchObject({
			active: true,
			title: "Fresh title",
			seasonNumber: null,
		});
		expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
			model.create.mock.invocationCallOrder[0],
		);
	});
	it("rejects a sixth pick but allows editing one of five", async () => {
		const active = Array.from({ length: 5 }, (_, i) =>
			pick(`${i}`, { mediaId: i }),
		);
		const { service } = setup(active);
		await expect(service.publish(input)).rejects.toBeInstanceOf(
			ConflictException,
		);
		await expect(service.publish(input, "0")).resolves.toMatchObject({
			id: "0",
		});
	});
	it("rejects duplicate exact Media Items, allowing different seasons", async () => {
		const { service } = setup([pick()]);
		await expect(service.publish(input)).rejects.toThrow("already featured");
		await expect(
			service.publish({ ...input, mediaType: "season", seasonNumber: 1 }),
		).resolves.toMatchObject({ seasonNumber: 1 });
	});
	it.each([
		{ mediaType: "season" },
		{ seasonNumber: 1 },
		{ sourceUrl: "https://example.com" },
		{ sourceLabel: "Watch trailer" },
		{ expiresAt: "2000-01-01T00:00:00Z" },
		{ expiresAt: "2099-01-01" },
	])("rejects inconsistent publication data %j", async (change) => {
		const { service, model } = setup();
		await expect(
			service.publish({ ...input, ...change } as PublishFeaturedDto),
		).rejects.toThrow();
		expect(model.create).not.toHaveBeenCalled();
	});
	it("retains inactive edits without consuming a slot or requiring future expiry", async () => {
		const { service } = setup(
			Array.from({ length: 5 }, (_, i) => pick(`${i}`, { mediaId: i })),
		);
		expect(
			await service.publish(
				{ ...input, published: false, expiresAt: "2000-01-01T00:00:00Z" },
				"0",
			),
		).toMatchObject({ active: false });
	});
	it("uses saved metadata during outages but hides confirmed missing titles", async () => {
		const { service, catalog } = setup([
			pick("outage"),
			pick("missing"),
			pick("expired", { expiresAt: new Date(0) }),
		]);
		catalog.resolve
			.mockRejectedValueOnce(new Error("offline"))
			.mockRejectedValueOnce(new NotFoundException());
		expect((await service.selection()).items).toEqual([
			expect.objectContaining({ id: "outage", title: "Saved title" }),
		]);
	});
	it("refuses publication when catalog verification fails", async () => {
		const { service, catalog, model } = setup();
		catalog.resolve.mockRejectedValue(new Error("offline"));
		await expect(service.publish(input)).rejects.toThrow("Couldn't verify");
		expect(model.create).not.toHaveBeenCalled();
	});
	it("reorders the exact active set and rejects stale or duplicate orders", async () => {
		const { service, model } = setup([pick("a"), pick("b", { mediaId: 3 })]);
		await expect(service.reorder(["a"])).rejects.toThrow("selection changed");
		await expect(service.reorder(["a", "a"])).rejects.toThrow(
			"selection changed",
		);
		await service.reorder(["b", "a"]);
		expect(model.update).toHaveBeenNthCalledWith(1, {
			where: { id: "b" },
			data: { position: 0 },
		});
	});
	it("removes a pick without deleting its reusable record", async () => {
		const { service, model } = setup([pick()]);
		await service.remove("one");
		expect(model.updateMany).toHaveBeenCalledWith({
			where: { id: "one" },
			data: { published: false },
		});
	});
});
