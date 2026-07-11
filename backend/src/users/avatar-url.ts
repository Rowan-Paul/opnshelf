function backendBaseUrl(): string {
	return (
		process.env.BACKEND_PUBLIC_URL ??
		process.env.BACKEND_URL ??
		"http://127.0.0.1:3001"
	);
}

/** Absolute URL for the avatar proxy endpoint, based on this instance's
 * public URL. */
export function buildAvatarUrl(did: string, cid: string): string {
	const url = new URL("/users/avatar", backendBaseUrl());
	url.searchParams.set("did", did);
	url.searchParams.set("cid", cid);
	return url.toString();
}

/**
 * Stored avatar URLs embed whatever base URL the backend had when the profile
 * was indexed — a dev backend once wrote tunnel-host URLs into live rows. Any
 * response serving a stored avatar URL must re-base it onto this instance's
 * public URL instead of trusting the stored host.
 */
export function rebaseAvatarUrl(stored: string | null): string | null {
	if (!stored) return null;
	try {
		const url = new URL(stored);
		if (url.pathname !== "/users/avatar") return stored;
		return new URL(url.pathname + url.search, backendBaseUrl()).toString();
	} catch {
		return stored;
	}
}
