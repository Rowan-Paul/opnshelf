import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { AuthenticatedRequest } from "../auth/types";

const { fileInterceptorCalls } = vi.hoisted(() => ({
	fileInterceptorCalls: [] as unknown[][],
}));

vi.mock("@nestjs/platform-express", () => ({
	FileInterceptor: (...args: unknown[]) => {
		fileInterceptorCalls.push(args);
		return class MockFileInterceptor {};
	},
}));

vi.mock("./users.service", () => ({
	UsersService: class MockUsersService {},
}));

vi.mock("../auth/auth.guard", () => ({
	AuthGuard: class MockAuthGuard {
		canActivate() {
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

// Most handlers just read `did` off the request and forward to UsersService;
// that behavior is covered in users.service.spec. We keep one representative
// forwarding smoke test plus the handlers that own real logic: the two
// request guards and the deleteMyAccount sync/async status-code + DTO branch.
describe("UsersController", () => {
	let controller: UsersController;

	const usersService = {
		completeOnboarding: vi.fn(),
		fetchTraktPublicHistory: vi.fn(),
		startTraktImport: vi.fn(),
		getCurrentTraktImport: vi.fn(),
		importBlueskyFollows: vi.fn(),
		importNormalizedItems: vi.fn(),
		getPublicProfileByHandle: vi.fn(),
		getUserSettings: vi.fn(),
		updateUserSettings: vi.fn(),
		updateUserProfile: vi.fn(),
		uploadUserAvatar: vi.fn(),
		deleteUserAvatar: vi.fn(),
		streamUserAvatar: vi.fn(),
		deleteUserSync: vi.fn(),
		createDeletionJob: vi.fn(),
		getCurrentDeletionJob: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [UsersController],
			providers: [
				{ provide: UsersService, useValue: usersService },
				{ provide: SocialService, useValue: {} },
			],
		}).compile();

		controller = module.get<UsersController>(UsersController);
	});

	it("configures strict multipart limits for avatar uploads", () => {
		expect(fileInterceptorCalls).toContainEqual([
			"avatar",
			{
				limits: {
					fileSize: 5 * 1024 * 1024,
					files: 1,
					fields: 0,
					parts: 1,
					fieldNestingDepth: 1,
				},
			},
		]);
	});

	it("forwards the authenticated did to the service (representative wiring)", async () => {
		usersService.completeOnboarding.mockResolvedValue({
			onboardingCompletedAt: "2026-03-03T12:00:00.000Z",
			needsOnboarding: false,
		});

		const req = {
			user: { did: "did:plc:abc", session: {} },
		} as AuthenticatedRequest;

		await expect(controller.completeOnboarding(req)).resolves.toEqual({
			onboardingCompletedAt: "2026-03-03T12:00:00.000Z",
			needsOnboarding: false,
		});
		expect(usersService.completeOnboarding).toHaveBeenCalledWith("did:plc:abc");
	});

	it("rejects avatar upload when the file is missing", async () => {
		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;

		await expect(controller.uploadMyAvatar(undefined, req)).rejects.toThrow(
			BadRequestException,
		);
		expect(usersService.uploadUserAvatar).not.toHaveBeenCalled();
	});

	it("rejects import when session is missing", async () => {
		const req = {
			user: { did: "did:plc:abc", session: undefined },
		} as unknown as AuthenticatedRequest;

		await expect(
			controller.importMyHistory(
				{
					items: [
						{
							type: "movie",
							movieTmdbId: 10,
							watchedAt: "2026-01-01T00:00:00.000Z",
						},
					],
				},
				req,
			),
		).rejects.toThrow(BadRequestException);
		expect(usersService.importNormalizedItems).not.toHaveBeenCalled();
	});

	it("deletes the current account synchronously when PDS deletion is not requested", async () => {
		usersService.deleteUserSync.mockResolvedValue(undefined);

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;
		const res = { status: vi.fn() } as unknown as import("express").Response;

		const result = await controller.deleteMyAccount(
			{ deletePDSData: false },
			req,
			res,
		);
		expect(result).toBeUndefined();
		expect(usersService.deleteUserSync).toHaveBeenCalledWith("did:plc:abc");
		expect(res.status).toHaveBeenCalledWith(204);
	});

	it("creates an async deletion job when PDS deletion is requested", async () => {
		const mockJob = {
			id: "job-1",
			status: "queued",
			data: {
				deletePdsData: true,
				totalRecords: 10,
				deletedRecords: 0,
			},
			lastError: null,
			createdAt: new Date("2026-03-27T12:00:00.000Z"),
		};
		usersService.createDeletionJob.mockResolvedValue(mockJob);

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;
		const res = { status: vi.fn() } as unknown as import("express").Response;

		const result = await controller.deleteMyAccount(
			{ deletePDSData: true },
			req,
			res,
		);
		expect(result).toMatchObject({
			id: "job-1",
			status: "queued",
			totalRecords: 10,
			deletedRecords: 0,
		});
		expect(usersService.createDeletionJob).toHaveBeenCalledWith(
			"did:plc:abc",
			true,
		);
		expect(res.status).toHaveBeenCalledWith(200);
	});
});
