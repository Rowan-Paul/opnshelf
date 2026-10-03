import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { FeaturedCatalogService } from "./featured-catalog.service";
import { FeaturedService } from "./featured.service";

// Opt-in against a disposable local database only; never backend/.env.
const url = process.env.FEATURED_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
	throw new Error("Featured integration tests require a local database");
describe.skipIf(!url)("Featured Content PostgreSQL transactions", () => {
	const db = new PrismaClient({
		adapter: new PrismaPg({ connectionString: url, max: 8 }),
	});
	const catalog = {
		resolve: async () => ({ title: "Fixture title", posterPath: null }),
	};
	const service = new FeaturedService(
		db as unknown as PrismaService,
		catalog as unknown as FeaturedCatalogService,
	);
	const input = (mediaId: number) => ({
		mediaType: "movie" as const,
		mediaId,
		message: "Fixture announcement",
		expiresAt: "2099-01-01T00:00:00Z",
	});
	beforeEach(async () => {
		await db.featuredContent.deleteMany();
	});
	afterAll(async () => {
		await db.featuredContent.deleteMany();
		await db.$disconnect();
	});
	it("serializes six concurrent publications without exceeding five", async () => {
		const results = await Promise.allSettled(
			Array.from({ length: 6 }, (_, i) => service.publish(input(i + 1))),
		);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(5);
		expect(await db.featuredContent.count()).toBe(5);
	});
	it("serializes duplicate publication, reorders, expires, and reuses records", async () => {
		const duplicates = await Promise.allSettled([
			service.publish(input(1)),
			service.publish(input(1)),
		]);
		expect(
			duplicates.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		const first = (await service.selection()).items[0];
		const second = await service.publish(input(2));
		await service.reorder([second.id, first.id]);
		expect((await service.selection()).items.map((item) => item.id)).toEqual([
			second.id,
			first.id,
		]);
		await db.featuredContent.update({
			where: { id: first.id },
			data: { expiresAt: new Date(0) },
		});
		expect((await service.selection()).items.map((item) => item.id)).toEqual([
			second.id,
		]);
		await service.remove(second.id);
		expect((await service.list({ status: "inactive" })).total).toBe(2);
		const republished = await service.publish(input(1), first.id);
		expect(republished.id).toBe(first.id);
		expect((await service.selection()).items).toHaveLength(1);
	});
});
