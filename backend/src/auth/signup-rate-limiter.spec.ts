import { HttpException } from "@nestjs/common";
import { SignupRateLimiter } from "./signup-rate-limiter";

describe("SignupRateLimiter", () => {
	let limiter: SignupRateLimiter;

	beforeEach(() => {
		limiter = new SignupRateLimiter();
	});

	it("allows five signups per IP per hour and rejects the sixth with 429", () => {
		for (let i = 0; i < 5; i++) {
			expect(() => limiter.enforceRegisterRateLimit("9.9.9.9")).not.toThrow();
		}
		let thrown: unknown;
		try {
			limiter.enforceRegisterRateLimit("9.9.9.9");
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(HttpException);
		expect((thrown as HttpException).getStatus()).toBe(429);
		// Another address has its own bucket.
		expect(() => limiter.enforceRegisterRateLimit("9.9.9.8")).not.toThrow();
	});

	it("frees the signup bucket once the hour has passed", () => {
		vi.useFakeTimers();
		try {
			for (let i = 0; i < 5; i++) limiter.enforceRegisterRateLimit("1.1.1.1");
			vi.advanceTimersByTime(60 * 60 * 1000 + 1);
			expect(() => limiter.enforceRegisterRateLimit("1.1.1.1")).not.toThrow();
		} finally {
			vi.useRealTimers();
		}
	});

	it("limits verification-email resends per DID, independent of signups", () => {
		for (let i = 0; i < 5; i++) {
			expect(() =>
				limiter.enforceResendRateLimit("did:plc:ratelimit"),
			).not.toThrow();
		}
		expect(() => limiter.enforceResendRateLimit("did:plc:ratelimit")).toThrow(
			HttpException,
		);
		expect(() => limiter.enforceResendRateLimit("did:plc:other")).not.toThrow();
		expect(() => limiter.enforceRegisterRateLimit("2.2.2.2")).not.toThrow();
	});
});
