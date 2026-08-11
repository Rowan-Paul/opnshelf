import { Smartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { posthog } from "#/integrations/posthog/provider";
import { detectPlatform } from "#/lib/platform";
import {
	dismissMobileApp,
	isMobileAppDismissed,
	startPromptCooldown,
	useHydrated,
} from "#/lib/prompt-state";
import StoreBadges from "./StoreBadges";

/**
 * Home Prompt offering the Mobile App, in the shape the Trakt and AT Store
 * cards already use.
 *
 * Desktop only. A mobile visitor gets the Banner or Apple's Smart App Banner
 * instead, so nobody is asked twice on one screen. Dismissal is permanent and
 * per-device, on the same key the Banner uses.
 */
export function MobileAppPrompt() {
	const hydrated = useHydrated();
	const [dismissed, setDismissed] = useState(false);
	const platform = detectPlatform();

	if (platform.isMobile) return null;
	if (!hydrated || dismissed || isMobileAppDismissed()) return null;

	return (
		<section className="overflow-hidden rounded-xl border border-(--border) bg-(--background-subtle)">
			<div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
				<div className="flex min-w-0 items-start gap-4">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--accent-subtle) text-(--accent)">
						<Smartphone className="size-5" aria-hidden="true" />
					</div>
					<div>
						<h2 className="font-semibold text-lg">Opnshelf is on your phone</h2>
						<p className="mt-1 max-w-xl text-(--foreground-muted) text-sm leading-6">
							Track what you watch wherever you are. The app is on the App Store
							and Google Play.
						</p>
					</div>
				</div>
				<div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
					<StoreBadges
						className="justify-start sm:justify-end"
						platform={platform}
					/>
					<Button
						type="button"
						variant="ghost"
						onClick={() => {
							dismissMobileApp();
							startPromptCooldown();
							setDismissed(true);
							posthog.capture("mobile_app_prompt_dismissed", {
								surface: "home_prompt",
							});
						}}
					>
						No thanks
					</Button>
				</div>
			</div>
		</section>
	);
}
