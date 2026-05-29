/**
 * Minimal className joiner for Uniwind. Uniwind resolves Tailwind classes at
 * build time, so we only need to flatten/conditionally include strings (no
 * tailwind-merge needed on native).
 */
export function cn(
	...inputs: Array<string | false | null | undefined>
): string {
	return inputs.filter(Boolean).join(" ");
}
