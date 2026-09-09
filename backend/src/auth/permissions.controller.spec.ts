import type { Mock } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing the controller/AuthService
vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

// Mock @atproto modules to prevent import errors
vi.mock("@atproto/oauth-client-node", () => ({}));
vi.mock("@atproto/api", () => ({}));
vi.mock("@atproto/tap", () => ({
	Tap: vi.fn(),
	SimpleIndexer: vi.fn(),
}));

import { AuthService } from "./auth.service";
import { PermissionsController } from "./permissions.controller";

describe("PermissionsController", () => {
	let controller: PermissionsController;

	const mockAuthService: {
		getUser: Mock;
		hasBlueskyProfile: Mock;
		authorizePermissionChange: Mock;
	} = {
		getUser: vi.fn(),
		hasBlueskyProfile: vi.fn().mockResolvedValue(false),
		authorizePermissionChange: vi.fn(),
	};

	const createMockRequest = (
		overrides: Partial<import("express").Request> = {},
	) => {
		return {
			url: "/auth/permissions",
			cookies: {},
			...overrides,
		} as unknown as import("express").Request;
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockAuthService.hasBlueskyProfile.mockResolvedValue(false);

		const module: TestingModule = await Test.createTestingModule({
			controllers: [PermissionsController],
			providers: [{ provide: AuthService, useValue: mockAuthService }],
		}).compile();

		controller = module.get<PermissionsController>(PermissionsController);
	});

	describe("permissions", () => {
		it("returns an authorization URL for an authenticated Blog connection", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				reviewsPublicationUri:
					"at://did:plc:abc123/site.standard.publication/main",
				reviewsMirrorFormat: "leaflet",
				blogIntegrationEnabled: false,
				blueskyCrossPostEnabled: false,
			});
			mockAuthService.authorizePermissionChange.mockResolvedValue(
				"https://pds.example/authorize?request=blog",
			);
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: { did: "did:plc:abc123" } },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			const result = await controller.permissions(req, {
				integration: "blog",
				action: "connect",
			});

			expect(result).toEqual({
				authorizationUrl: "https://pds.example/authorize?request=blog",
			});
			expect(mockAuthService.authorizePermissionChange).toHaveBeenCalledWith(
				"reader.example",
				"blog",
				{
					blogEnabled: true,
					blueskyEnabled: false,
					reviewsMirrorFormat: "leaflet",
				},
			);
		});

		it("requests the one-time AT Store bundle with mobile resume state", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				reviewsMirrorFormat: "markdown",
				blogIntegrationEnabled: false,
				blueskyCrossPostEnabled: false,
			});
			mockAuthService.authorizePermissionChange.mockResolvedValue(
				"https://pds.example/authorize?request=atstore",
			);
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: { did: "did:plc:abc123" } },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			await controller.permissions(req, {
				integration: "atstore",
				action: "connect",
				platform: "mobile",
			});

			expect(mockAuthService.authorizePermissionChange).toHaveBeenCalledWith(
				"reader.example",
				"atstore",
				{
					atStoreReviewEnabled: true,
					blogEnabled: false,
					blueskyEnabled: false,
					reviewsMirrorFormat: "markdown",
				},
				{ platform: "mobile" },
			);
		});

		it("carries the mobile code challenge into the permission-change state", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				reviewsMirrorFormat: "markdown",
				blogIntegrationEnabled: false,
				blueskyCrossPostEnabled: false,
			});
			mockAuthService.authorizePermissionChange.mockResolvedValue(
				"https://pds.example/authorize?request=atstore",
			);
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: { did: "did:plc:abc123" } },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			await controller.permissions(req, {
				integration: "atstore",
				action: "connect",
				platform: "mobile",
				codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
			});

			expect(mockAuthService.authorizePermissionChange).toHaveBeenCalledWith(
				"reader.example",
				"atstore",
				expect.any(Object),
				{
					platform: "mobile",
					codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
				},
			);
		});

		it("refuses a Blog connection before a public publication is chosen", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				reviewsPublicationUri: null,
				blogIntegrationEnabled: false,
				blueskyCrossPostEnabled: false,
			});
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: { did: "did:plc:abc123" } },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			await expect(
				controller.permissions(req, { integration: "blog", action: "connect" }),
			).rejects.toThrow(BadRequestException);
			expect(mockAuthService.authorizePermissionChange).not.toHaveBeenCalled();
		});

		it("refuses a Bluesky connection without a public Bluesky profile", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				blogIntegrationEnabled: false,
				blueskyCrossPostEnabled: false,
			});
			mockAuthService.hasBlueskyProfile.mockResolvedValue(false);
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: { did: "did:plc:abc123" } },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			await expect(
				controller.permissions(req, {
					integration: "bluesky",
					action: "connect",
				}),
			).rejects.toThrow(BadRequestException);
			expect(mockAuthService.authorizePermissionChange).not.toHaveBeenCalled();
		});

		it("disconnecting keeps the other saved integrations in the cumulative set", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				reviewsMirrorFormat: "leaflet",
				blogIntegrationEnabled: true,
				blueskyCrossPostEnabled: true,
			});
			mockAuthService.authorizePermissionChange.mockResolvedValue(
				"https://pds.example/authorize?request=bluesky",
			);
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: { did: "did:plc:abc123" } },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			await controller.permissions(req, {
				integration: "bluesky",
				action: "disconnect",
			});

			expect(mockAuthService.hasBlueskyProfile).not.toHaveBeenCalled();
			expect(mockAuthService.authorizePermissionChange).toHaveBeenCalledWith(
				"reader.example",
				"bluesky",
				{
					blogEnabled: true,
					blueskyEnabled: false,
					reviewsMirrorFormat: "leaflet",
				},
			);
		});
	});
});
