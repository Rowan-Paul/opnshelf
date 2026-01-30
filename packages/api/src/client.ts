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
	const headers: Record<string, string> = {};
	if (sessionToken) {
		headers['Authorization'] = `Bearer ${sessionToken}`;
	}

	client.setConfig({
		baseUrl,
		headers,
		credentials: 'include',
	});
}

// Set up response interceptor for 401 handling
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

// Auth functions
export async function getAuthUser(): Promise<AuthUser | null> {
	try {
		const headers: HeadersInit = {};
		if (sessionToken) {
			headers['Authorization'] = `Bearer ${sessionToken}`;
		}

		const response = await fetch(`${baseUrl}/auth/me`, {
			credentials: 'include',
			headers,
		});

		if (response.status === 401) {
			onUnauthorized?.();
		}

		if (!response.ok) {
			return null;
		}

		return response.json();
	} catch {
		return null;
	}
}

export function getLoginUrl(handle?: string): string {
	const params = handle ? `?handle=${encodeURIComponent(handle)}` : '';
	return `${baseUrl}/auth/login${params}`;
}

export async function logout(): Promise<void> {
	const headers: HeadersInit = {};
	if (sessionToken) {
		headers['Authorization'] = `Bearer ${sessionToken}`;
	}

	await fetch(`${baseUrl}/auth/logout`, {
		method: 'POST',
		credentials: 'include',
		headers,
	});

	// Clear session token on logout
	sessionToken = null;
	updateClientConfig();
}
