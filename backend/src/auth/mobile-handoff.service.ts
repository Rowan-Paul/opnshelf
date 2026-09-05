import { randomBytes, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { computeCodeChallenge } from "./oauth-app-state";

export interface MobileHandoffChallenge {
	codeVerifier: string;
	codeChallenge: string;
	expiresAt: Date;
}

interface PendingMobileHandoff {
	sessionId: string;
	codeChallenge: string;
	expiresAt: number;
}

/**
 * Mobile Handoff Codes (ADR 0026): the `opnshelf://` scheme can be claimed by
 * any installed app, so the mobile OAuth callback hands the Mobile App a
 * single-use code bound to a PKCE-style challenge instead of the session id.
 */
@Injectable()
export class MobileHandoffService {
	/**
	 * Single-use Mobile Handoff Codes minted at the mobile OAuth callback, keyed
	 * by code. In-memory on purpose: the backend runs one replica (ADR 0025) and
	 * a code only has to survive the few seconds between the redirect and the
	 * app's exchange call. Pruned on every mint and exchange.
	 */
	private readonly pendingMobileHandoffs = new Map<
		string,
		PendingMobileHandoff
	>();
	private static readonly MOBILE_HANDOFF_CODE_TTL_MS = 60 * 1000;
	/** Advisory only: the OAuth state the challenge rides in expires on its own. */
	private static readonly MOBILE_HANDOFF_CHALLENGE_TTL_MS = 10 * 60 * 1000;

	/**
	 * Mint a verifier/challenge pair for a Mobile Handoff Code flow (ADR 0026).
	 *
	 * The app has no CSPRNG or SHA-256 of its own, so the backend generates both
	 * halves over TLS. Nothing is stored: the challenge travels in the OAuth state
	 * and the exchange only has to compare hash(verifier) against it.
	 */
	createMobileHandoffChallenge(): MobileHandoffChallenge {
		const codeVerifier = randomBytes(32).toString("base64url");
		return {
			codeVerifier,
			codeChallenge: computeCodeChallenge(codeVerifier),
			expiresAt: new Date(
				Date.now() + MobileHandoffService.MOBILE_HANDOFF_CHALLENGE_TTL_MS,
			),
		};
	}

	/**
	 * Bind a fresh session to a single-use code the mobile redirect can carry
	 * instead of the session id. Valid for 60 seconds, one exchange attempt.
	 */
	issueMobileHandoffCode(sessionId: string, codeChallenge: string): string {
		this.pruneMobileHandoffs();
		const code = randomBytes(32).toString("base64url");
		this.pendingMobileHandoffs.set(code, {
			sessionId,
			codeChallenge,
			expiresAt: Date.now() + MobileHandoffService.MOBILE_HANDOFF_CODE_TTL_MS,
		});
		return code;
	}

	/**
	 * Redeem a Mobile Handoff Code. The code is consumed on the first attempt
	 * whatever the outcome, so a hijacked redirect cannot be retried against a
	 * guessed verifier. Returns the session id, or null when the code is unknown,
	 * expired, or the verifier does not hash to the recorded challenge.
	 */
	exchangeMobileHandoffCode(
		code: string,
		codeVerifier: string,
	): { sessionId: string } | null {
		this.pruneMobileHandoffs();
		const pending = this.pendingMobileHandoffs.get(code);
		this.pendingMobileHandoffs.delete(code);
		if (!pending || pending.expiresAt <= Date.now()) return null;
		const expected = Buffer.from(pending.codeChallenge, "ascii");
		const actual = Buffer.from(computeCodeChallenge(codeVerifier), "ascii");
		if (
			expected.length !== actual.length ||
			!timingSafeEqual(expected, actual)
		) {
			return null;
		}
		return { sessionId: pending.sessionId };
	}

	private pruneMobileHandoffs(): void {
		const now = Date.now();
		for (const [code, pending] of this.pendingMobileHandoffs) {
			if (pending.expiresAt <= now) this.pendingMobileHandoffs.delete(code);
		}
	}
}
