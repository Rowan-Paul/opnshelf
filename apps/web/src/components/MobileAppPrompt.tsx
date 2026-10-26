import { Smartphone } from "lucide-react";
import { useState } from "react";
import { PromptCard } from "#/components/PromptCard";
import { Button } from "#/components/ui/button";
import { posthog } from "#/integrations/posthog/provider";
import { usePlatform } from "#/lib/platform";
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
	const platform = usePlatform();

	if (platform.isMobile) return null;
	if (!hydrated || dismissed || isMobileAppDismissed()) return null;

	return (
		<PromptCard
			icon={Smartphone}
			title="Opnshelf is on your phone"
			actions={
				<>
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
					<StoreBadges platform={platform} />
				</>
			}
		>
			Track what you watch wherever you are. The app is on the App Store and
			Google Play.
		</PromptCard>
	);
}
