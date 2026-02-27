import { client } from './generated/client.gen';

// Allow configuring base URL
let baseUrl = 'http://127.0.0.1:3001';

/** Session token for mobile auth (cookies don't work in native apps) */
let sessionToken: string | null = null;

/** Called when any API request returns 401. Set by the app to redirect to login. */
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: (() => void) | null): void {
	onUnauthorized = callback;
}

/**
 * Set the session token for mobile auth.
 * When set, requests will use Authorization header instead of cookies.
 */
export function setSessionToken(token: string | null): void {
	sessionToken = token;
	// Update client config with new auth header
	updateClientConfig();
}

/**
 * Get the current session token (useful for checking if logged in)
 */
export function getSessionToken(): string | null {
	return sessionToken;
}

function updateClientConfig() {
	client.setConfig({
		baseUrl,
		credentials: 'include',
		headers: sessionToken
			? {
					Authorization: `Bearer ${sessionToken}`,
				}
			: undefined,
	});
}

client.interceptors.response.use(async (response) => {
	if (response.status === 401) {
		onUnauthorized?.();
	}
	return response;
});

// Initialize client with default config
updateClientConfig();

export function configureApiClient(url: string) {
	baseUrl = url;
	updateClientConfig();
}

export { client };

// Auth types
export interface AuthUser {
	did: string;
	handle: string;
	displayName: string | null;
	avatar: string | null;
}

// Simple URL helper for login (not an API call)
export function getLoginUrl(handle?: string, timezone?: string, platform?: string): string {
	const params = new URLSearchParams();
	if (handle) params.set("handle", handle);
	if (timezone) params.set("timezone", timezone);
	if (platform) params.set("platform", platform);
	const queryString = params.toString();
	return `${baseUrl}/auth/login${queryString ? `?${queryString}` : ""}`;
}

// URL helper for PDS signup (redirects to the PDS's built-in account creation page)
export function getSignupUrl(timezone?: string, platform?: string): string {
	const params = new URLSearchParams();
	if (timezone) params.set("timezone", timezone);
	if (platform) params.set("platform", platform);
	const queryString = params.toString();
	return `${baseUrl}/auth/signup${queryString ? `?${queryString}` : ""}`;
}
