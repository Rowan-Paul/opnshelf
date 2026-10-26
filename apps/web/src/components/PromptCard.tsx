import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one card shape every Home Prompt uses, matching the Mobile App's
 * `PromptCard`. Prompts had drifted into two radii, two surfaces, an icon-less
 * variant and two dismiss styles; side by side in the slot they read as
 * unrelated components.
 *
 * Renders a single element on purpose: `PromptSlot` hides every child after
 * the first, so a wrapper would hide the real Prompt.
 */
export function PromptCard({
	icon: Icon,
	title,
	children,
	actions,
}: {
	icon: LucideIcon;
	title: ReactNode;
	/** The one-sentence explanation under the title. */
	children: ReactNode;
	/** Dismiss (ghost) first, then the primary action. */
	actions: ReactNode;
}) {
	return (
		<section className="overflow-hidden rounded-2xl border border-(--border) bg-(--background-elevated) p-5 sm:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
				<div className="flex min-w-0 items-start gap-4">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--accent-subtle) text-(--accent)">
						<Icon className="size-5" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<h2 className="font-display font-semibold text-lg">{title}</h2>
						<p className="mt-1 max-w-xl text-(--foreground-muted) text-sm leading-6">
							{children}
						</p>
					</div>
				</div>
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
					{actions}
				</div>
			</div>
		</section>
	);
}
