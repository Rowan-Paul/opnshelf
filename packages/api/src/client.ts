import { client } from './generated/client.gen';

// Allow configuring base URL
let baseUrl = 'http://127.0.0.1:3001';

/** Session token for mobile auth (cookies don't work in native apps) */
let sessionToken: string | null = null;

/** Called when any API request returns 401. Set by the app to redirect to login. */
let onUnauthorized: (() => void) | null = null;

/**
 * Which install this client is (ADR-0015). Sent on every request; the backend
 * stamps it onto the session row the first time it differs, which is what makes
 * the Devices screen possible. Each app supplies its own values — the platform
 * vendor id on mobile, a localStorage uuid on web.
 */
let device: { id: string; name?: string; platform?: string } | null = null;

export function setDeviceIdentity(
	identity: { id: string; name?: string; platform?: string } | null,
): void {
	device = identity;
	updateClientConfig();
}

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
		headers.Authorization = `Bearer ${sessionToken}`;
	}
	if (device) {
		headers["x-opnshelf-device"] = device.id;
		// Header values must stay ASCII: a device name can carry anything the
		// platform reports ("Rowans iPhone", non-Latin scripts), and a raw
		// non-ASCII byte makes fetch throw before the request leaves.
		if (device.name) {
			headers["x-opnshelf-device-name"] = encodeURIComponent(device.name);
		}
		if (device.platform) {
			headers["x-opnshelf-device-platform"] = device.platform;
		}
	}
	client.setConfig({
		baseUrl,
		credentials: 'include',
		headers: Object.keys(headers).length > 0 ? headers : undefined,
	});
}

client.interceptors.response.use(async (response) => {
	if (response.status === 401) {
		onUnauthorized?.();
	}
	// Nest answers a `null` controller result with a bodiless 200, and the
	// generated client turns an empty body into `{}`. Endpoints typed
	// `X | null` then hand the app a truthy empty object, so `if (job)` passes
	// and the first field read blows up. Give them real null instead.
	if (response.ok && response.headers.get("content-length") === "0") {
		return new Response("null", {
			status: response.status,
			statusText: response.statusText,
			headers: { "content-type": "application/json" },
		});
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
	onboardingCompletedAt: string | null;
	needsOnboarding: boolean;
}

export interface BlueskyProfileStatus {
	hasBlueskyProfile: boolean;
}

export async function getBlueskyProfileStatus(): Promise<BlueskyProfileStatus> {
	const { data } = await client.get<BlueskyProfileStatus>({
		url: "/auth/me/bluesky-profile-status",
	});
	if (!data) {
		throw new Error("Missing Bluesky profile status response");
	}
	return data;
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
