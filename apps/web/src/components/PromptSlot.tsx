import type { ReactNode } from "react";
import { isPromptCooldownActive, useHydrated } from "#/lib/prompt-state";

/**
 * The reserved Prompt slot on Home. Shows at most one Prompt, and goes quiet
 * for a few days after any of them is dismissed.
 *
 * ponytail: "one at a time, in priority order" is DOM order plus one CSS rule.
 * An ineligible Prompt returns null and contributes no element, so the first
 * child is always the highest-priority eligible one and the rule hides the
 * rest. The alternative — every Prompt reporting eligibility to a registry so
 * the slot can pick — is about sixty lines to reach the same screen. Upgrade to
 * that only if a Prompt ever needs to know it lost.
 *
 * Constraint that comes with it: children must be the Prompts themselves, never
 * wrapped in a spacing div, or the wrapper counts as the first child and the
 * real Prompt gets hidden. A Prompt may also render only one element (portalled
 * dialogs are fine, since they leave the slot).
 */
export function PromptSlot({ children }: { children: ReactNode }) {
	const hydrated = useHydrated();

	if (!hydrated || isPromptCooldownActive()) return null;

	return (
		<div className="mb-8 empty:hidden [&>*:nth-child(n+2)]:hidden">
			{children}
		</div>
	);
}
