import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

/**
 * Hand-rolled signup limiters (ADR 0025). Both `/auth/register` and
 * `/auth/google/register` draw from the same per-IP bucket, which is why the
 * maps live in one shared singleton rather than on either controller. In
 * process memory on purpose: the backend runs one replica, and a reset on
 * deploy only hands whoever was mid-window a fresh quota.
 */
@Injectable()
export class SignupRateLimiter {
	/** Per-IP signup attempts, used by a lightweight in-memory rate limiter. */
	private readonly registerAttempts = new Map<string, number[]>();
	private static readonly REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
	private static readonly REGISTER_MAX_PER_WINDOW = 5;

	/** Per-DID resend attempts for verification emails (in-memory rate limiter). */
	private readonly resendAttempts = new Map<string, number[]>();
	private static readonly RESEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour
	private static readonly RESEND_MAX_PER_WINDOW = 5;

	enforceRegisterRateLimit(ip: string): void {
		const now = Date.now();
		const windowStart = now - SignupRateLimiter.REGISTER_WINDOW_MS;
		const recent = (this.registerAttempts.get(ip) || []).filter(
			(t) => t > windowStart,
		);
		if (recent.length >= SignupRateLimiter.REGISTER_MAX_PER_WINDOW) {
			throw new HttpException(
				"Too many signup attempts. Please try again later.",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
		recent.push(now);
		this.registerAttempts.set(ip, recent);
	}

	enforceResendRateLimit(did: string): void {
		const now = Date.now();
		const windowStart = now - SignupRateLimiter.RESEND_WINDOW_MS;
		const recent = (this.resendAttempts.get(did) || []).filter(
			(t) => t > windowStart,
		);
		if (recent.length >= SignupRateLimiter.RESEND_MAX_PER_WINDOW) {
			throw new HttpException(
				"Too many resend attempts. Please try again later.",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
		recent.push(now);
		this.resendAttempts.set(did, recent);
	}
}
