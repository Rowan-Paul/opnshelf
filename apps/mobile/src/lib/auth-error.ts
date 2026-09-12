/**
 * Error codes the backend sends back through `opnshelf://auth/complete`, and
 * what to tell the user about them.
 *
 * Kept in one place because two unrelated paths receive the same codes: the
 * in-app auth session, which resolves with the redirect URL, and the
 * `auth/complete` route, which Android often gets instead. A code known to only
 * one of them shows a vague "unexpected error" on the other.
 */

/** Thrown when the auth flow came back carrying an error instead of a session. */
export class AuthFlowError extends Error {
	readonly code: string;

	constructor(code: string) {
		super(`Auth flow failed: ${code}`);
		this.name = "AuthFlowError";
		this.code = code;
	}
}

export function authErrorMessage(code: string): string {
	switch (code) {
		case "handle_required":
			return "Please provide your handle to sign in.";
		case "auth_failed":
			return "Authentication failed. Please check your handle and try again.";
		case "callback_failed":
			return "Something went wrong during sign in. Please try again.";
		case "permission_declined":
			return "Review permission was not granted.";
		// Sign in with Apple runs in a browser on Android (ADR 0027), so its
		// signup failures arrive here rather than from the native credential.
		case "apple_unavailable":
			return "Sign in with Apple isn't available right now. Please try another way to sign in.";
		case "apple_failed":
			return "Sign in with Apple didn't complete. Please try again.";
		case "apple_email_unverified":
			return "Apple hasn't verified that email address, so an account can't be created with it.";
		default:
			return "An unexpected error occurred. Please try again.";
	}
}
