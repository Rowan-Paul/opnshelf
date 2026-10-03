import { ConflictException, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeaturedContent } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { FeaturedCatalogueService } from "./featured-catalogue.service";
import { FeaturedService } from "./featured.service";
import type { PublishFeaturedDto } from "./featured.dto";

const input: PublishFeaturedDto = {
	mediaType: "movie",
	mediaId: 42,
	message: "New trailer",
	expiresAt: "2099-01-01T12:00:00Z",
};
function entry(
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
			.mockImplementation(({ data }) => Promise.resolve(entry("new", data))),
		update: vi
			.fn()
			.mockImplementation(({ data, where }) =>
				Promise.resolve(entry(where.id, data)),
			),
		updateMany: vi.fn().mockResolvedValue({ count: 1 }),
	};
	const tx = { featuredContent: model, $executeRaw: vi.fn() };
	const prisma = { ...tx, $transaction: vi.fn(async (fn) => fn(tx)) };
	const catalogue = {
		resolve: vi
			.fn()
			.mockResolvedValue({ title: "Fresh title", posterPath: "/fresh.jpg" }),
	};
	const service = new FeaturedService(
		prisma as unknown as PrismaService,
		catalogue as unknown as FeaturedCatalogueService,
	);
	return { model, tx, catalogue, service };
}
afterEach(() => vi.useRealTimers());
describe("Featured Content", () => {
	it("bounds public lookup latency during a hanging catalogue request", async () => {
		vi.useFakeTimers();
		const { service, catalogue } = setup([entry()]);
		catalogue.resolve.mockReturnValue(new Promise(() => {}));
		const response = service.selection();
		await vi.advanceTimersByTimeAsync(1500);
		expect((await response).items).toEqual([
			expect.objectContaining({ title: "Saved title" }),
		]);
	});
	it("publishes verified catalogue metadata after taking the editorial lock", async () => {
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
	it("rejects a sixth entry but allows editing one of five", async () => {
		const active = Array.from({ length: 5 }, (_, i) =>
			entry(`${i}`, { mediaId: i }),
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
		const { service } = setup([entry()]);
		await expect(service.publish(input)).rejects.toThrow("already featured");
		await expect(
			service.publish({ ...input, mediaType: "season", seasonNumber: 1 }),
		).resolves.toMatchObject({ seasonNumber: 1 });
	});
	it("allows a show and its season, but rejects the same season twice", async () => {
		const { service } = setup([
			entry("show", { mediaType: "show" }),
			entry("season", { mediaType: "season", seasonNumber: 1 }),
		]);
		await expect(
			service.publish({ ...input, mediaType: "season", seasonNumber: 2 }),
		).resolves.toMatchObject({ seasonNumber: 2 });
		await expect(
			service.publish({ ...input, mediaType: "season", seasonNumber: 1 }),
		).rejects.toThrow("already featured");
	});
	it("rechecks expiry after slow catalogue verification before writing", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
		const { service, catalogue, model } = setup();
		catalogue.resolve.mockImplementation(async () => {
			vi.setSystemTime(new Date("2026-10-03T12:00:03Z"));
			return { title: "Title", posterPath: null };
		});
		await expect(
			service.publish({ ...input, expiresAt: "2026-10-03T12:00:02Z" }),
		).rejects.toThrow("Expiry must be in the future");
		expect(model.create).not.toHaveBeenCalled();
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
			Array.from({ length: 5 }, (_, i) => entry(`${i}`, { mediaId: i })),
		);
		expect(
			await service.publish(
				{ ...input, published: false, expiresAt: "2000-01-01T00:00:00Z" },
				"0",
			),
		).toMatchObject({ active: false });
	});
	it("uses saved metadata during outages but hides confirmed missing titles", async () => {
		const { service, catalogue } = setup([
			entry("outage"),
			entry("missing"),
			entry("expired", { expiresAt: new Date(0) }),
		]);
		catalogue.resolve
			.mockRejectedValueOnce(new Error("offline"))
			.mockRejectedValueOnce(new NotFoundException());
		expect((await service.selection()).items).toEqual([
			expect.objectContaining({ id: "outage", title: "Saved title" }),
		]);
	});
	it("refuses publication when catalogue verification fails", async () => {
		const { service, catalogue, model } = setup();
		catalogue.resolve.mockRejectedValue(new Error("offline"));
		await expect(service.publish(input)).rejects.toThrow("Couldn't verify");
		expect(model.create).not.toHaveBeenCalled();
	});
	it("reorders the exact active set and rejects stale or duplicate orders", async () => {
		const { service, model } = setup([entry("a"), entry("b", { mediaId: 3 })]);
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
	it("removes a entry without deleting its reusable record", async () => {
		const { service, model } = setup([entry()]);
		await service.remove("one");
		expect(model.updateMany).toHaveBeenCalledWith({
			where: { id: "one" },
			data: { published: false },
		});
	});
});
