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
	console.log('[API Client] setSessionToken called:', token ? token.substring(0, 20) + '...' : 'null');
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
	});
}

client.interceptors.request.use(async (request) => {
	console.log('[API Client] Request interceptor called');
	console.log('[API Client] Current sessionToken:', sessionToken ? `${sessionToken.substring(0, 20)}...` : 'null');
	console.log('[API Client] Request URL:', request.url);
	console.log('[API Client] Request headers before:', Array.from(request.headers.entries()));
	if (sessionToken) {
		request.headers.set('Authorization', `Bearer ${sessionToken}`);
		console.log('[API Client] Authorization header set');
	} else {
		console.log('[API Client] No sessionToken - skipping Authorization header');
	}
	console.log('[API Client] Request headers after:', Array.from(request.headers.entries()));
	return request;
});

client.interceptors.response.use(async (response) => {
	console.log('[API Client] Response interceptor called');
	console.log('[API Client] Response status:', response.status);
	if (response.status === 401) {
		console.log('[API Client] 401 detected - calling onUnauthorized');
		onUnauthorized?.();
	} else {
		console.log('[API Client] Response OK');
	}
	return response;
});

// Initialize client with default config
console.log('[API Client] Initializing client with default config');
updateClientConfig();

export function configureApiClient(url: string) {
	console.log('[API Client] configureApiClient called with url:', url);
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
export function getLoginUrl(handle?: string): string {
	const params = handle ? `?handle=${encodeURIComponent(handle)}` : '';
	return `${baseUrl}/auth/login${params}`;
}
