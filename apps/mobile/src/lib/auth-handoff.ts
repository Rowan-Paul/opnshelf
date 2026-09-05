import {
	authControllerMobileChallenge,
	authControllerMobileExchange,
} from "@opnshelf/api";
import * as SecureStore from "expo-secure-store";

/**
 * Mobile Handoff Code (ADR 0026).
 *
 * The `opnshelf://` scheme can be claimed by any installed app, so the OAuth
 * callback must not put the session id in the redirect. Instead the backend
 * mints a verifier/challenge pair for us over TLS; the challenge rides in the
 * OAuth state and the callback hands back a single-use code that only the
 * holder of the verifier can redeem.
 *
 * The verifier lives in memory for the flow, and briefly in SecureStore so the
 * `auth/complete` deep-link route can still find it when Android delivers the
 * redirect to a fresh activity instead of resolving the auth session.
 */
const VERIFIER_KEY = "opnshelf_auth_code_verifier";

let inMemoryVerifier: string | null = null;

/**
 * Ask the backend for a challenge and remember its verifier. Returns `null`
 * when the backend does not offer the endpoint yet (older deployment) or the
 * call fails, in which case the caller starts the legacy `session=` flow.
 */
export async function beginHandoff(): Promise<string | null> {
	try {
		const { data } = await authControllerMobileChallenge({
			throwOnError: true,
		});
		if (!data?.codeVerifier || !data.codeChallenge) return null;
		inMemoryVerifier = data.codeVerifier;
		await SecureStore.setItemAsync(VERIFIER_KEY, data.codeVerifier);
		return data.codeChallenge;
	} catch (error) {
		console.warn("Falling back to the legacy sign-in handoff", error);
		await clearHandoff();
		return null;
	}
}

/** Forget the verifier everywhere. Safe to call when nothing is stored. */
export async function clearHandoff(): Promise<void> {
	inMemoryVerifier = null;
	try {
		await SecureStore.deleteItemAsync(VERIFIER_KEY);
	} catch {
		// Nothing stored, or storage unavailable: either way there is nothing left.
	}
}

async function takeVerifier(): Promise<string | null> {
	const verifier =
		inMemoryVerifier ?? (await SecureStore.getItemAsync(VERIFIER_KEY));
	await clearHandoff();
	return verifier;
}

/**
 * Redeem the code from the redirect for the session id. The verifier is
 * consumed whatever the outcome; the backend consumes the code the same way.
 */
export async function redeemHandoffCode(code: string): Promise<string> {
	const codeVerifier = await takeVerifier();
	if (!codeVerifier) {
		throw new Error("No pending sign-in to complete");
	}
	const { data } = await authControllerMobileExchange({
		body: { code, codeVerifier },
		throwOnError: true,
	});
	if (!data?.sessionId) {
		throw new Error("No session returned from the sign-in exchange");
	}
	return data.sessionId;
}
