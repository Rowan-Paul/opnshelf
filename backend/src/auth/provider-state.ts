import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** A provider round trip is abandoned rather than resumed after this long. */
export const PROVIDER_STATE_TTL_MS = 15 * 60 * 1000;

export interface ProviderStatePayload {
	/** Random per flow. Makes each state unique and unguessable. */
	nonce: string;
	/** Millisecond epoch the state was minted, for expiry. */
	issuedAt: number;
}

/**
 * Signed CSRF state for a provider round trip (ADR 0028).
 *
 * Google compares a `google_state` cookie on the way back, which Apple cannot
 * do: Apple requires `response_mode=form_post` whenever the `email` scope is
 * requested, so its callback is a cross-site POST and a SameSite=Lax cookie is
 * simply not sent. The state carries its own integrity instead.
 *
 * This is deliberately not `serializeOAuthAppState`: that one is unsigned,
 * which is fine on the atproto leg where the OAuth client library holds the
 * real CSRF protection in the `authState` table, and not fine here where
 * nothing else is guarding.
 */
export function signProviderState(secret: string): string {
	const payload: ProviderStatePayload = {
		nonce: randomBytes(16).toString("base64url"),
		issuedAt: Date.now(),
	};
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${body}.${hmac(secret, body)}`;
}

/**
 * Returns the payload when the state was minted by us and has not expired, and
 * null otherwise. Every rejection returns null rather than throwing: the caller
 * treats all of them the same way, and distinguishing them for the caller would
 * mean distinguishing them for an attacker too.
 */
export function verifyProviderState(
	secret: string,
	state: string | undefined,
	now = Date.now(),
): ProviderStatePayload | null {
	if (!state) return null;

	const separator = state.lastIndexOf(".");
	if (separator <= 0) return null;

	const body = state.slice(0, separator);
	const signature = state.slice(separator + 1);
	if (!constantTimeEquals(signature, hmac(secret, body))) return null;

	let payload: ProviderStatePayload;
	try {
		payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
	} catch {
		return null;
	}

	if (
		typeof payload?.issuedAt !== "number" ||
		typeof payload?.nonce !== "string"
	)
		return null;
	// A future issuedAt means a tampered or clock-skewed payload; the signature
	// already rules out tampering, so treat it as unusable either way.
	const age = now - payload.issuedAt;
	if (age < 0 || age > PROVIDER_STATE_TTL_MS) return null;

	return payload;
}

function hmac(secret: string, body: string): string {
	return createHmac("sha256", secret).update(body).digest("base64url");
}

function constantTimeEquals(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	// timingSafeEqual throws on a length mismatch, which is itself a leak-free
	// signal: the HMAC output is fixed-length, so a different length is a
	// malformed state rather than a near-miss guess.
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}
