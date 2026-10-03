import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { BackendEnv, parseEnvironment } from "../config/env.schema";
import { FeaturedAdminGuard } from "./featured-admin.guard";
import { FeaturedController } from "./featured.controller";
import { FeaturedService } from "./featured.service";

let app: INestApplication;
const featured = {
	selection: vi.fn().mockResolvedValue({ items: [] }),
	list: vi.fn().mockResolvedValue({ items: [] }),
	publish: vi.fn().mockResolvedValue({ id: "pick" }),
	remove: vi.fn(),
	reorder: vi.fn(),
};
beforeAll(async () => {
	const mod = await Test.createTestingModule({
		controllers: [FeaturedController],
		providers: [
			FeaturedAdminGuard,
			{
				provide: BackendEnv,
				useValue: parseEnvironment({ FEATURED_ADMIN_DID: "did:plc:editor" }),
			},
			{ provide: FeaturedService, useValue: featured },
			{
				provide: AuthService,
				useValue: {
					getSessionById: vi.fn(async (id) => ({
						id,
						userDid: id,
						expiresAt: new Date("2099-01-01"),
						lastUsedAt: new Date(),
					})),
					restoreBySession: vi.fn(async (record) => ({
						did: record.id === "editor" ? "did:plc:editor" : "did:plc:reader",
					})),
					touchSession: vi.fn(),
					parseDeviceHeaders: vi.fn(),
				},
			},
		],
	}).compile();
	app = mod.createNestApplication();
	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
	await app.init();
});
afterAll(async () => app.close());
describe("editorial HTTP boundary", () => {
	it("allows public reading and reports per-account editing access", async () => {
		await request(app.getHttpServer()).get("/featured").expect(200);
		expect(
			(
				await request(app.getHttpServer())
					.get("/featured/access")
					.set("Authorization", "Bearer reader")
			).body,
		).toEqual({ canEdit: false });
	});
	it.each([
		["get", "/featured/manage"],
		["post", "/featured/manage"],
		["put", "/featured/manage/pick"],
		["delete", "/featured/manage/pick"],
		["put", "/featured/manage/order"],
	] as const)(
		"protects %s %s from guests and ordinary users",
		async (method, path) => {
			await request(app.getHttpServer())[method](path).expect(401);
			await request(app.getHttpServer())
				[method](path)
				.set("Authorization", "Bearer reader")
				.expect(403);
		},
	);
	it("fails closed when no editor DID is configured", () => {
		const guard = new FeaturedAdminGuard(parseEnvironment({}));
		expect(guard.canEdit("did:plc:editor")).toBe(false);
		expect(guard.canEdit()).toBe(false);
	});
	const body = {
		mediaType: "season",
		mediaId: 1,
		seasonNumber: 0,
		message: " Specials announced ",
		expiresAt: "2099-01-01T00:00:00Z",
	};
	it("accepts the editor and trims plain-text copy", async () => {
		await request(app.getHttpServer())
			.post("/featured/manage")
			.set("Authorization", "Bearer editor")
			.send(body)
			.expect(201);
		expect(featured.publish).toHaveBeenCalledWith(
			expect.objectContaining({ message: "Specials announced" }),
		);
	});
	it.each([
		{ message: " " },
		{ message: "a".repeat(281) },
		{ sourceUrl: "javascript:alert(1)" },
		{ sourceUrl: "http://example.com" },
		{ mediaType: "episode" },
		{ mediaId: -1 },
		{ published: "false" },
		{ published: null },
	])("validates editor input %j", async (change) => {
		await request(app.getHttpServer())
			.post("/featured/manage")
			.set("Authorization", "Bearer editor")
			.send({ ...body, ...change })
			.expect(400);
	});
});
