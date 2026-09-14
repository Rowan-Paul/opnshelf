import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { Inject, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "../auth/auth.service";
import { extractSessionId } from "../auth/session-id";

/**
 * Rate-limit bucket keyed on the caller's session instead of the peer IP.
 *
 * The web app renders on the server, so its API calls all leave from one
 * container. With an IP-only tracker every logged-in user shares a single
 * bucket, and one busy account (an import, an account deletion poll) throttles
 * everybody else. Keying on the session id gives each account its own bucket
 * whether the call comes from the browser, the SSR render, or mobile.
 *
 * Only a session the AuthService currently holds live gets its own bucket.
 * Keying on the raw credential let an anonymous caller mint a fresh bucket per
 * request with a random Bearer value, which bypassed the limit on public
 * routes and cost a database lookup per request on guarded ones before the
 * 401. An unknown credential now falls into the IP bucket like any other
 * anonymous request. A real session's first request after a login or a
 * process restart lands there once; AuthGuard then restores it and every
 * later request keys on the session.
 *
 * Anonymous SSR requests use the visitor IP only when the Web server signs
 * it with SSR_RATE_LIMIT_SECRET. Unverified headers stay in the peer-IP bucket.
 */
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
	// Property injection keeps ThrottlerGuard's constructor signature out of
	// this file; the parent still receives its own three dependencies.
	@Inject(AuthService)
	private readonly authService: AuthService;

	protected async getTracker(req: Record<string, unknown>): Promise<string> {
		const sessionId = extractSessionId(req as never);
		return sessionId && this.authService.isKnownSession(sessionId)
			? `session:${sessionId}`
			: `ip:${verifiedSsrIp(req) ?? (req as { ip?: string }).ip ?? "unknown"}`;
	}
}

/** A forwarded identity is not authentication; it only selects an IP bucket. */
function verifiedSsrIp(req: Record<string, unknown>): string | undefined {
	const secret = process.env.SSR_RATE_LIMIT_SECRET;
	if (!secret || secret.length < 32) return;
	const headers = req.headers as Record<string, unknown> | undefined;
	const ip = headers?.["x-opnshelf-client-ip"];
	const timestamp = headers?.["x-opnshelf-client-time"];
	const signature = headers?.["x-opnshelf-client-signature"];
	if (
		typeof ip !== "string" ||
		!isIP(ip) ||
		typeof timestamp !== "string" ||
		!/^\d{13}$/.test(timestamp) ||
		Math.abs(Date.now() - Number(timestamp)) > 60_000 ||
		typeof signature !== "string" ||
		!/^[a-f0-9]{64}$/.test(signature)
	)
		return;
	const expected = createHmac("sha256", secret)
		.update(`${ip}\n${timestamp}`)
		.digest();
	if (timingSafeEqual(expected, Buffer.from(signature, "hex"))) return ip;
}
