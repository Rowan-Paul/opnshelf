import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { FeedbackIssuesService } from "./feedback-issues.service";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";

vi.mock("../auth/auth.service", () => ({ AuthService: class {} }));

describe("POST /feedback", () => {
	let app: INestApplication;
	const prisma = {
		feedback: { create: vi.fn(), findUnique: vi.fn() },
		user: { findUnique: vi.fn() },
	};
	const issues = { createIssue: vi.fn() };
	const auth = {
		getSessionById: vi.fn(),
		restoreBySession: vi.fn(),
		touchSession: vi.fn(),
		parseDeviceHeaders: vi.fn(),
	};
	const body = { category: "bug", message: "Feedback without a session" };

	beforeAll(async () => {
		const module = await Test.createTestingModule({
			controllers: [FeedbackController],
			providers: [
				FeedbackService,
				AuthGuard,
				{ provide: AuthService, useValue: auth },
				{ provide: PrismaService, useValue: prisma },
				{ provide: FeedbackIssuesService, useValue: issues },
			],
		}).compile();
		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		vi.resetAllMocks();
		prisma.feedback.create.mockResolvedValue({
			id: "feedback-id",
			...body,
			createdAt: new Date("2026-09-25T12:00:00Z"),
		});
	});

	it("accepts and notifies about feedback without a session", async () => {
		const response = await request(app.getHttpServer())
			.post("/feedback")
			.send(body);

		expect(response.status).toBe(201);
		expect(response.body.id).toBe("feedback-id");
		expect(prisma.feedback.create).toHaveBeenCalledWith({
			data: {
				...body,
				userDid: null,
				pageUrl: undefined,
				screenshot: undefined,
			},
		});
		expect(prisma.user.findUnique).not.toHaveBeenCalled();
		expect(issues.createIssue).toHaveBeenCalledWith("feedback-id", body);
	});

	it("keeps feedback linked to a valid session", async () => {
		auth.getSessionById.mockResolvedValue({
			id: "session-id",
			expiresAt: new Date(Date.now() + 60_000),
		});
		auth.restoreBySession.mockResolvedValue({ did: "did:plc:test" });
		prisma.user.findUnique.mockResolvedValue({
			handle: "test.example.com",
			displayName: "Test User",
		});

		await request(app.getHttpServer())
			.post("/feedback")
			.set("Authorization", "Bearer session-id")
			.send(body)
			.expect(201);

		expect(prisma.feedback.create).toHaveBeenCalledWith({
			data: {
				...body,
				userDid: "did:plc:test",
				pageUrl: undefined,
				screenshot: undefined,
			},
		});
		expect(issues.createIssue).toHaveBeenCalledWith("feedback-id", body);
	});

	it("accepts feedback anonymously when the session no longer exists", async () => {
		auth.getSessionById.mockResolvedValue(null);
		await request(app.getHttpServer())
			.post("/feedback")
			.set("Authorization", "Bearer expired-session")
			.send(body)
			.expect(201);
		expect(prisma.feedback.create).toHaveBeenCalledWith({
			data: {
				...body,
				userDid: null,
				pageUrl: undefined,
				screenshot: undefined,
			},
		});
	});

	it("saves an optional screenshot and serves only its JPEG bytes", async () => {
		const screenshot = "/9j/2Q==";
		await request(app.getHttpServer())
			.post("/feedback")
			.send({ ...body, screenshot })
			.expect(201);
		expect(prisma.feedback.create).toHaveBeenCalledWith({
			data: { ...body, userDid: null, pageUrl: undefined, screenshot },
		});
		prisma.feedback.findUnique.mockResolvedValue({ screenshot });
		const response = await request(app.getHttpServer())
			.get("/feedback/feedback-id/screenshot")
			.expect(200);
		expect(response.headers["content-type"]).toContain("image/jpeg");
		expect(response.body).toEqual(Buffer.from(screenshot, "base64"));
	});

	it("returns 404 for missing screenshots", async () => {
		prisma.feedback.findUnique.mockResolvedValue(null);
		await request(app.getHttpServer())
			.get("/feedback/missing/screenshot")
			.expect(404);
	});

	it.each(["<script>bad</script>", "a".repeat(80001), 123])(
		"rejects invalid screenshot %s",
		async (screenshot) => {
			await request(app.getHttpServer())
				.post("/feedback")
				.send({ ...body, screenshot })
				.expect(400);
			expect(prisma.feedback.create).not.toHaveBeenCalled();
		},
	);

	it("still validates anonymous feedback", async () => {
		await request(app.getHttpServer())
			.post("/feedback")
			.send({ ...body, category: "invalid" })
			.expect(400);
		expect(prisma.feedback.create).not.toHaveBeenCalled();
		expect(issues.createIssue).not.toHaveBeenCalled();
	});
});
