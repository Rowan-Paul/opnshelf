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
import { DeviceSessionsService } from "./device-sessions.service";
import { MobileHandoffController } from "./mobile-handoff.controller";
import { MobileHandoffService } from "./mobile-handoff.service";

describe("MobileHandoffController", () => {
	let controller: MobileHandoffController;

	const mockMobileHandoff: {
		createMobileHandoffChallenge: Mock;
		exchangeMobileHandoffCode: Mock;
	} = {
		createMobileHandoffChallenge: vi.fn(),
		exchangeMobileHandoffCode: vi.fn(),
	};

	const mockSessions: { getSessionById: Mock } = {
		getSessionById: vi.fn(),
	};

	const mockAuthService: { getUser: Mock } = {
		getUser: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [MobileHandoffController],
			providers: [
				{ provide: MobileHandoffService, useValue: mockMobileHandoff },
				{ provide: DeviceSessionsService, useValue: mockSessions },
				{ provide: AuthService, useValue: mockAuthService },
			],
		}).compile();

		controller = module.get<MobileHandoffController>(MobileHandoffController);
	});

	describe("mobileChallenge", () => {
		it("returns the minted pair with an ISO expiry", () => {
			const expiresAt = new Date("2026-09-05T10:00:00.000Z");
			mockMobileHandoff.createMobileHandoffChallenge.mockReturnValue({
				codeVerifier: "verifier",
				codeChallenge: "challenge",
				expiresAt,
			});

			expect(controller.mobileChallenge()).toEqual({
				codeVerifier: "verifier",
				codeChallenge: "challenge",
				expiresAt: "2026-09-05T10:00:00.000Z",
			});
		});
	});

	describe("mobileExchange", () => {
		const verifier = "V".repeat(43);

		it("returns the session and its account for a valid code", async () => {
			mockMobileHandoff.exchangeMobileHandoffCode.mockReturnValue({
				sessionId: "session-123",
			});
			mockSessions.getSessionById.mockResolvedValue({
				id: "session-123",
				userDid: "did:plc:abc123",
			});
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "user.bsky.social",
			});

			await expect(
				controller.mobileExchange({
					code: "handoff-code",
					codeVerifier: verifier,
				}),
			).resolves.toEqual({
				sessionId: "session-123",
				did: "did:plc:abc123",
				handle: "user.bsky.social",
			});
			expect(mockMobileHandoff.exchangeMobileHandoffCode).toHaveBeenCalledWith(
				"handoff-code",
				verifier,
			);
		});

		it("answers a rejected code with a generic 400", async () => {
			mockMobileHandoff.exchangeMobileHandoffCode.mockReturnValue(null);

			await expect(
				controller.mobileExchange({
					code: "handoff-code",
					codeVerifier: verifier,
				}),
			).rejects.toThrow(BadRequestException);
			expect(mockSessions.getSessionById).not.toHaveBeenCalled();
		});

		it("answers a code whose session has since been revoked with the same 400", async () => {
			mockMobileHandoff.exchangeMobileHandoffCode.mockReturnValue({
				sessionId: "session-123",
			});
			mockSessions.getSessionById.mockResolvedValue(null);

			await expect(
				controller.mobileExchange({
					code: "handoff-code",
					codeVerifier: verifier,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("answers a code whose account row is gone with the same 400", async () => {
			mockMobileHandoff.exchangeMobileHandoffCode.mockReturnValue({
				sessionId: "session-123",
			});
			mockSessions.getSessionById.mockResolvedValue({
				id: "session-123",
				userDid: "did:plc:abc123",
			});
			mockAuthService.getUser.mockResolvedValue(null);

			await expect(
				controller.mobileExchange({
					code: "handoff-code",
					codeVerifier: verifier,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});
});
