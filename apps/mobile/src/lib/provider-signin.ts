import {
	authControllerAppleNative,
	authControllerGoogleNative,
} from "@opnshelf/api";
import {
	GoogleSignin,
	isErrorWithCode,
	statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { beginHandoff } from "./auth-handoff";
import { env } from "./env";

export type Provider = "apple" | "google";

/**
 * What the backend decided about a native credential.
 *
 * `authorize` is a returning user: the PDS bound their existing account to an
 * authorization request and the app finishes it in a browser, because the
 * consent screen is the authorization boundary and cannot be skipped.
 *
 * `register` is a new user: the app shows its own handle picker and holds the
 * pending registration until it is spent.
 */
export type ProviderSignInResult =
	| { kind: "authorize"; authorizationUrl: string }
	| { kind: "register"; pendingToken: string; email: string }
	| { kind: "cancelled" };

/** Thrown when the user could sign in, but not on this device. */
export class ProviderUnavailableError extends Error {}

/**
 * Apple's own credential UI is iOS-only. Android falls back to the browser
 * flow, which is the same Service ID round trip the web uses (ADR 0027).
 */
export function supportsNativeApple(): boolean {
	return Platform.OS === "ios";
}

export function isGoogleConfigured(): boolean {
	if (!env.googleWebClientId) return false;
	// On iOS the config plugin is registered only when the iOS client id exists
	// (app.config.ts derives its URL scheme from it), so without one the native
	// module has no scheme to return to and sign-in cannot complete. Hiding the
	// button beats offering one that dead-ends.
	if (Platform.OS === "ios" && !env.googleIosClientId) return false;
	return true;
}

let googleConfigured = false;

function configureGoogle(): void {
	if (googleConfigured) return;
	if (!env.googleWebClientId) {
		throw new ProviderUnavailableError("Google sign-in is not configured");
	}
	GoogleSignin.configure({
		// The audience of the id_token we forward. Must be the web client the PDS
		// validates against, not the iOS one.
		webClientId: env.googleWebClientId,
		iosClientId: env.googleIosClientId,
	});
	googleConfigured = true;
}

/** Ask the OS for an Apple identity token. */
async function getAppleIdentityToken(): Promise<string | null> {
	if (!(await AppleAuthentication.isAvailableAsync())) {
		throw new ProviderUnavailableError("Sign in with Apple is not available");
	}
	try {
		const credential = await AppleAuthentication.signInAsync({
			requestedScopes: [
				AppleAuthentication.AppleAuthenticationScope.EMAIL,
				// Requested because Apple wants it declared, but deliberately unused:
				// the name arrives once, on the first authorization only, and
				// Onboarding collects a display name a few steps later anyway.
				AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
			],
		});
		// Present on every sign-in, unlike credential.email which Apple only
		// populates the first time. The email we use comes from this token.
		if (!credential.identityToken) {
			// Distinct from cancellation: the user did authorise, and silently
			// treating this as a back-out would hide a real failure.
			throw new Error("Apple returned no identity token");
		}
		return credential.identityToken;
	} catch (error) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error as { code?: string }).code === "ERR_REQUEST_CANCELED"
		) {
			return null;
		}
		throw error;
	}
}

/** Ask the OS for a Google identity token. */
async function getGoogleIdentityToken(): Promise<string | null> {
	configureGoogle();
	try {
		await GoogleSignin.hasPlayServices({
			showPlayServicesUpdateDialog: true,
		});
		const response = await GoogleSignin.signIn();
		if (response.type === "cancelled") return null;
		if (!response.data.idToken) {
			throw new Error("Google returned no identity token");
		}
		return response.data.idToken;
	} catch (error) {
		if (
			isErrorWithCode(error) &&
			error.code === statusCodes.SIGN_IN_CANCELLED
		) {
			return null;
		}
		throw error;
	}
}

/**
 * Sign in with a credential the operating system produced, then let the
 * backend decide whether it belongs to an account already.
 *
 * The credential never touches a browser: the app posts the identity token
 * straight to the backend, which forwards it to the PDS to verify.
 */
export async function signInWithProvider(
	provider: Provider,
): Promise<ProviderSignInResult> {
	const identityToken =
		provider === "apple"
			? await getAppleIdentityToken()
			: await getGoogleIdentityToken();

	// Null means the user backed out, and nothing else: both getters throw when
	// a token is missing for any other reason.
	if (!identityToken) return { kind: "cancelled" };

	// Mint the handoff challenge before the exchange: the backend has to put it
	// in the OAuth request it creates here, or the consent callback later reads
	// the flow as web and redirects to the site instead of back into the app.
	const codeChallenge = await beginHandoff();

	const call =
		provider === "apple"
			? authControllerAppleNative
			: authControllerGoogleNative;
	const { data } = await call({
		body: {
			identityToken,
			platform: "mobile",
			...(codeChallenge ? { codeChallenge } : {}),
		},
		throwOnError: true,
	});

	if (data?.redirectUrl) {
		return { kind: "authorize", authorizationUrl: data.redirectUrl };
	}
	if (data?.pendingToken && data.email) {
		return {
			kind: "register",
			pendingToken: data.pendingToken,
			email: data.email,
		};
	}
	throw new Error("Sign-in did not return anything to continue with");
}
