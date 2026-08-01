import {
	configureApiClient,
	setDeviceIdentity,
	setSessionToken,
} from "@opnshelf/api";
import * as SecureStore from "expo-secure-store";
import { nativeDeviceIdentity } from "./device";
import { env } from "./env";

const SESSION_TOKEN_KEY = "opnshelf_session_token";

/**
 * Point the shared `@opnshelf/api` client at the backend. The base URL comes
 * from env (see `lib/env.ts`); it is never hardcoded with a secret.
 */
export function initializeApiClient(): void {
	configureApiClient(env.apiUrl);
	// Claim this install as a Device (ADR-0015). Fire-and-forget: the id only
	// needs to be attached before the app's first authenticated request, and a
	// failure here must not block startup.
	void nativeDeviceIdentity()
		.then(setDeviceIdentity)
		.catch(() => setDeviceIdentity(null));
}

/**
 * Load a persisted session token (native apps can't use cookies) and apply it
 * to the API client. Returns the token if present.
 */
export async function loadSessionToken(): Promise<string | null> {
	try {
		const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
		setSessionToken(token);
		return token;
	} catch (error) {
		setSessionToken(null);
		throw error;
	}
}

/** Persist (or clear) the session token and update the API client. */
export async function saveSessionToken(token: string | null): Promise<void> {
	if (token) {
		await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
		setSessionToken(token);
	} else {
		await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
		setSessionToken(null);
	}
}
