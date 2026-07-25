import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { posthog } from "#/integrations/posthog/provider";

/**
 * Hands a URL to the OS share sheet, falling back to the clipboard on desktop.
 * `url` may be a path — it is resolved against the current origin on click.
 */
export function ShareButton({
	url,
	surface,
	className = "btn btn-secondary btn-sm gap-1.5",
}: {
	url: string;
	surface: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);

	const handleShare = async () => {
		const absolute = new URL(url, window.location.href).toString();
		if (navigator.share) {
			try {
				await navigator.share({ title: document.title, url: absolute });
				posthog.capture("share_completed", { surface });
			} catch {
				// User cancelled or share failed
			}
			return;
		}
		try {
			await navigator.clipboard.writeText(absolute);
			posthog.capture("share_completed", { surface });
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard write failed
		}
	};

	return (
		<button type="button" onClick={handleShare} className={className}>
			{copied ? (
				<Check className="size-3.5 text-green-500" />
			) : (
				<Share2 className="size-3.5" />
			)}
			{copied ? "Link copied" : "Share"}
		</button>
	);
}
