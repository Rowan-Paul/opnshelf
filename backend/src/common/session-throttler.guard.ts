import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
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
 * ponytail: anonymous SSR traffic still collapses onto the container IP.
 * Forward the client IP from the SSR fetch wrapper if guests start hitting 429.
 */
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
	protected async getTracker(req: Record<string, unknown>): Promise<string> {
		const sessionId = extractSessionId(req as never);
		return sessionId
			? `session:${sessionId}`
			: `ip:${(req as { ip?: string }).ip ?? "unknown"}`;
	}
}
