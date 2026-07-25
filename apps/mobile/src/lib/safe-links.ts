const EDITOR_PATHNAME = "/embed/review-editor";

function parseHttpUrl(value: string): URL | null {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url : null;
	} catch {
		return null;
	}
}

/** Whether user-authored content may be handed to the operating system. */
export function isExternalWebUrl(value: string): boolean {
	return parseHttpUrl(value) !== null;
}

/**
 * Open a public web URL without leaking rejected input or surfacing platform
 * failures to the render event handler.
 */
export function openExternalWebUrl(
	value: string,
	openUrl: (url: string) => Promise<unknown>,
): void {
	if (!isExternalWebUrl(value)) return;
	void openUrl(value).catch(() => {});
}

function parseSiteOrigin(siteUrl: string): URL | null {
	const url = parseHttpUrl(siteUrl);
	if (!url) return null;
	if (
		url.username !== "" ||
		url.password !== "" ||
		(url.pathname !== "" && url.pathname !== "/") ||
		url.search !== "" ||
		url.hash !== ""
	) {
		return null;
	}
	return url;
}

/** Normalized origin used by the editor WebView's origin whitelist. */
export function trustedEditorOrigin(siteUrl: string): string | null {
	return parseSiteOrigin(siteUrl)?.origin ?? null;
}

/** Build the one trusted editor route from the configured site origin. */
export function trustedEditorUrl(
	siteUrl: string,
	theme: string,
): string | null {
	const site = parseSiteOrigin(siteUrl);
	if (!site) return null;
	const editorUrl = new URL(EDITOR_PATHNAME, site.origin);
	editorUrl.searchParams.set("theme", theme);
	return editorUrl.toString();
}

/**
 * Whether a bridge message came from the trusted editor origin. Android's
 * WebMessageListener reports only the source *origin* — no pathname — so
 * messages can only be checked at origin granularity. Safe because the WebView
 * can never navigate off the editor route (see `isTrustedEditorUrl`).
 */
export function isTrustedEditorMessageOrigin(
	value: string,
	siteUrl: string,
): boolean {
	const site = parseSiteOrigin(siteUrl);
	const candidate = parseHttpUrl(value);
	return Boolean(
		site &&
			candidate &&
			candidate.username === "" &&
			candidate.password === "" &&
			candidate.origin === site.origin,
	);
}

/** Whether a navigation targets the one trusted editor page. */
export function isTrustedEditorUrl(value: string, siteUrl: string): boolean {
	return (
		isTrustedEditorMessageOrigin(value, siteUrl) &&
		parseHttpUrl(value)?.pathname === EDITOR_PATHNAME
	);
}
