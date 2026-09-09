import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { AuthenticatedRequest } from "../auth/types";

// Deliberately does NOT mock @nestjs/platform-express: the point of this spec
// is to push a real multipart body through the real FileInterceptor and its
// multer/busboy limits. users.controller.spec.ts mocks the interceptor away.

vi.mock("./users.service", () => ({
	UsersService: class MockUsersService {},
}));

vi.mock("../auth/auth.guard", () => ({
	AuthGuard: class MockAuthGuard {
		canActivate(context: ExecutionContext) {
			const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
			req.user = { did: "did:plc:test", session: { did: "did:plc:test" } };
			return true;
		}
	},
}));

vi.mock("../auth/optional-auth.guard", () => ({
	OptionalAuthGuard: class MockOptionalAuthGuard {
		canActivate() {
			return true;
		}
	},
}));

import { SocialService } from "../social/social.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("POST /users/me/profile/avatar multipart parsing", () => {
	let app: INestApplication;
	const usersService = { uploadUserAvatar: vi.fn() };

	beforeAll(async () => {
		const module = await Test.createTestingModule({
			controllers: [UsersController],
			providers: [
				{ provide: UsersService, useValue: usersService },
				{ provide: SocialService, useValue: {} },
			],
		}).compile();
		app = module.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		usersService.uploadUserAvatar.mockResolvedValue({ did: "did:plc:test" });
	});

	it("accepts a body with exactly one avatar part (what Web and Mobile send)", async () => {
		const response = await request(app.getHttpServer())
			.post("/users/me/profile/avatar")
			.attach("avatar", Buffer.alloc(1024, 1), {
				filename: "avatar.png",
				contentType: "image/png",
			});

		expect(response.status).toBe(201);
		expect(usersService.uploadUserAvatar).toHaveBeenCalledWith(
			"did:plc:test",
			{ did: "did:plc:test" },
			expect.objectContaining({ mimetype: "image/png", size: 1024 }),
		);
	});

	it("rejects an extra text field alongside the avatar", async () => {
		const response = await request(app.getHttpServer())
			.post("/users/me/profile/avatar")
			.field("extra", "x")
			.attach("avatar", Buffer.alloc(8), "avatar.png");

		expect(response.status).toBe(400);
		expect(usersService.uploadUserAvatar).not.toHaveBeenCalled();
	});

	it("rejects a second file part", async () => {
		const response = await request(app.getHttpServer())
			.post("/users/me/profile/avatar")
			.attach("avatar", Buffer.alloc(8), "a.png")
			.attach("avatar", Buffer.alloc(8), "b.png");

		expect(response.status).toBe(400);
		expect(usersService.uploadUserAvatar).not.toHaveBeenCalled();
	});
});
