import { MobileHandoffService } from "./mobile-handoff.service";
import { computeCodeChallenge } from "./oauth-app-state";

describe("MobileHandoffService", () => {
	let service: MobileHandoffService;

	beforeEach(() => {
		service = new MobileHandoffService();
	});

	describe("mobile handoff code", () => {
		it("mints a verifier whose S256 hash is the challenge", () => {
			const { codeVerifier, codeChallenge, expiresAt } =
				service.createMobileHandoffChallenge();

			expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
			expect(codeChallenge).toBe(computeCodeChallenge(codeVerifier));
			expect(codeChallenge).not.toBe(codeVerifier);
			expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
		});

		it("exchanges a code exactly once for the matching verifier", () => {
			const { codeVerifier, codeChallenge } =
				service.createMobileHandoffChallenge();
			const code = service.issueMobileHandoffCode("session-123", codeChallenge);

			expect(code).not.toContain("session-123");
			expect(service.exchangeMobileHandoffCode(code, codeVerifier)).toEqual({
				sessionId: "session-123",
			});
			// Reuse: the first exchange consumed it.
			expect(service.exchangeMobileHandoffCode(code, codeVerifier)).toBeNull();
		});

		it("consumes the code on a wrong verifier so it cannot be retried", () => {
			const { codeVerifier, codeChallenge } =
				service.createMobileHandoffChallenge();
			const code = service.issueMobileHandoffCode("session-123", codeChallenge);

			expect(
				service.exchangeMobileHandoffCode(code, "B".repeat(43)),
			).toBeNull();
			expect(service.exchangeMobileHandoffCode(code, codeVerifier)).toBeNull();
		});

		it("rejects an unknown code and an expired one", () => {
			expect(
				service.exchangeMobileHandoffCode("nope", "B".repeat(43)),
			).toBeNull();

			vi.useFakeTimers();
			try {
				const { codeVerifier, codeChallenge } =
					service.createMobileHandoffChallenge();
				const code = service.issueMobileHandoffCode(
					"session-123",
					codeChallenge,
				);
				vi.advanceTimersByTime(61_000);
				expect(
					service.exchangeMobileHandoffCode(code, codeVerifier),
				).toBeNull();
			} finally {
				vi.useRealTimers();
			}
		});
	});
});
