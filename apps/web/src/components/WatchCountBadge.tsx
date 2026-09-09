import { Check } from "lucide-react";

/**
 * The gold "watched" pill: a bare check for a single Watch, a check plus the
 * total for rewatches. Non-interactive — poster cards that let you toggle the
 * shelf state render their own button with the same shape.
 *
 * Shared by every read-only surface that states a Watch count (poster cards,
 * the detail page's Your Activity card) so the same number can't drift into
 * looking like two different things.
 */
export function WatchCountBadge({
	watchCount,
	className,
}: {
	/** Viewer-relative Watches. Undefined means "watched", count unknown. */
	watchCount?: number;
	/** Sizing + positioning for the surface this sits on. */
	className?: string;
}) {
	const showCount = !!watchCount && watchCount > 1;
	return (
		<div
			// Non-interactive badge, so it carries its meaning as an image role
			// rather than as a button label.
			role="img"
			className={`flex items-center justify-center rounded-full bg-(--accent) text-[#3f2e00] ${
				showCount ? "gap-1 px-2.5 sm:px-2" : ""
			} ${className ?? ""}`}
			aria-label={
				watchCount
					? `${watchCount} ${watchCount === 1 ? "watch" : "watches"} logged`
					: "Watched"
			}
		>
			<Check className="size-4 sm:size-3.5" />
			{showCount ? (
				<span className="font-bold text-xs tabular-nums">{watchCount}</span>
			) : null}
		</div>
	);
}
