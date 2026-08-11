import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";
import { posthog } from "#/integrations/posthog/provider";
import { detectPlatform } from "#/lib/platform";
import {
	dismissMobileApp,
	isMobileAppDismissed,
	useHydrated,
} from "#/lib/prompt-state";
import { APP_STORE_URL, PLAY_STORE_URL } from "./StoreBadges";

/**
 * Slim site-wide strip offering the Mobile App, matching TraktSyncBanner's
 * shape so the site has one Banner language rather than two.
 *
 * Not shown when:
 * - the visitor is on a desktop browser (the Home Prompt covers those)
 * - the browser is iOS Safari, which gets Apple's Smart App Banner instead
 * - the route is `/`, where the landing hero already advertises harder
 * - the ask was dismissed on this device, which is permanent
 */
export function MobileAppBanner() {
	const hydrated = useHydrated();
	const [dismissed, setDismissed] = useState(false);
	const isLanding = useRouterState({
		select: (s) => s.location.pathname === "/",
	});
	const { os, isMobile, isIosSafari } = detectPlatform();

	if (!isMobile || isIosSafari || isLanding) return null;
	// Wait for hydration before reading localStorage; this only delays showing.
	if (!hydrated || dismissed || isMobileAppDismissed()) return null;

	const isIos = os === "ios";
	const href = isIos ? APP_STORE_URL : PLAY_STORE_URL;
	const label = isIos ? "Get Opnshelf for iPhone" : "Get Opnshelf for Android";

	return (
		<div className="border-(--border) border-b bg-(--background-subtle)">
			<div className="container-app flex items-center gap-3 py-2 text-sm">
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					onClick={() =>
						posthog.capture("mobile_app_link_opened", {
							surface: "banner",
							store: isIos ? "app_store" : "play",
						})
					}
					className="min-w-0 flex-1 font-medium text-(--accent) hover:underline"
				>
					{label} →
				</a>
				<button
					type="button"
					onClick={() => {
						dismissMobileApp();
						setDismissed(true);
						posthog.capture("mobile_app_prompt_dismissed", {
							surface: "banner",
						});
					}}
					aria-label="Dismiss"
					className="rounded-md p-1 text-(--foreground-muted) hover:bg-(--background-elevated)"
				>
					<X className="size-4" />
				</button>
			</div>
		</div>
	);
}
