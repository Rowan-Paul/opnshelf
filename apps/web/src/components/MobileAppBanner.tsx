import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";
import { posthog } from "#/integrations/posthog/provider";
import { hideAppBanner } from "#/lib/app-banner";
import { dismissMobileApp } from "#/lib/prompt-state";
import { APP_STORE_URL, PLAY_STORE_URL } from "./StoreBadges";

/**
 * Slim site-wide strip offering the Mobile App, matching TraktSyncBanner's
 * shape so the site has one Banner language rather than two.
 *
 * Rendered for every visitor and hidden with CSS, decided before first paint
 * by `APP_BANNER_SCRIPT` (`#/lib/app-banner`), so it never appears late and
 * pushes the page down. Hidden when:
 * - the visitor is on a desktop browser (the Home Prompt covers those)
 * - the browser is iOS Safari, which gets Apple's Smart App Banner instead
 * - the ask was dismissed on this device, which is permanent
 * Not rendered on `/`, where the landing hero already advertises harder.
 */
export function MobileAppBanner() {
	const [dismissed, setDismissed] = useState(false);
	const isLanding = useRouterState({
		select: (s) => s.location.pathname === "/",
	});

	if (isLanding || dismissed) return null;

	const linkClass =
		"min-w-0 flex-1 font-medium text-(--accent) hover:underline";
	const capture = (store: "app_store" | "play") => () =>
		posthog.capture("mobile_app_link_opened", { surface: "banner", store });

	return (
		<div className="app-banner border-(--border) border-b bg-(--background-subtle)">
			<div className="container-app flex items-center gap-3 py-2 text-sm">
				<a
					href={APP_STORE_URL}
					target="_blank"
					rel="noopener noreferrer"
					onClick={capture("app_store")}
					className={`app-banner-ios ${linkClass}`}
				>
					Get Opnshelf for iPhone →
				</a>
				<a
					href={PLAY_STORE_URL}
					target="_blank"
					rel="noopener noreferrer"
					onClick={capture("play")}
					className={`app-banner-android ${linkClass}`}
				>
					Get Opnshelf for Android →
				</a>
				<button
					type="button"
					onClick={() => {
						dismissMobileApp();
						hideAppBanner();
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
