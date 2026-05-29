import { useEffect, useRef } from "react";

const SCRIPT_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

interface TurnstileApi {
	render: (
		el: HTMLElement,
		opts: {
			sitekey: string;
			callback: (token: string) => void;
			"expired-callback"?: () => void;
			"error-callback"?: () => void;
			theme?: "auto" | "light" | "dark";
		},
	) => string;
	remove: (widgetId: string) => void;
	reset: (widgetId?: string) => void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

function loadScript(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (window.turnstile) {
			resolve();
			return;
		}
		const existing = document.getElementById(SCRIPT_ID);
		if (existing) {
			existing.addEventListener("load", () => resolve());
			existing.addEventListener("error", () =>
				reject(new Error("Failed to load Turnstile")),
			);
			return;
		}
		const script = document.createElement("script");
		script.id = SCRIPT_ID;
		script.src = SCRIPT_SRC;
		script.async = true;
		script.defer = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to load Turnstile"));
		document.head.appendChild(script);
	});
}

/**
 * Cloudflare Turnstile captcha widget. Calls onVerify with a token the backend
 * verifies before minting a PDS invite code. If no site key is configured the
 * widget renders nothing and reports an empty token (dev convenience — the
 * backend disables verification when TURNSTILE_SECRET_KEY is unset).
 */
export function TurnstileWidget({
	siteKey,
	onVerify,
	onExpire,
}: {
	siteKey: string | undefined;
	onVerify: (token: string) => void;
	onExpire?: () => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!siteKey) {
			// No captcha configured (local dev): treat as a no-op pass.
			onVerify("");
			return;
		}

		let cancelled = false;
		void loadScript().then(() => {
			if (cancelled || !containerRef.current || !window.turnstile) return;
			widgetIdRef.current = window.turnstile.render(containerRef.current, {
				sitekey: siteKey,
				callback: (token) => onVerify(token),
				"expired-callback": () => onExpire?.(),
				"error-callback": () => onExpire?.(),
				theme: "auto",
			});
		});

		return () => {
			cancelled = true;
			if (widgetIdRef.current && window.turnstile) {
				window.turnstile.remove(widgetIdRef.current);
				widgetIdRef.current = null;
			}
		};
	}, [siteKey, onVerify, onExpire]);

	if (!siteKey) return null;
	return <div ref={containerRef} />;
}
