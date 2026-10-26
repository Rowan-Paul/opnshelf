import { useCSSVariable } from "uniwind";

/**
 * Theme-aware colors for props that take a color value instead of a className:
 * icon `color`, `tintColor`, `placeholderTextColor`, SVG `fill`.
 *
 * Read from the same CSS variables as `text-muted-foreground` / `text-primary`
 * (src/global.css), so they follow the light/dark theme. A hard-coded hex here
 * keeps one theme's value in both: `#94a3b8` is too faint on the light
 * background and `#f3bc00` is not the dark theme's accent.
 */
export function useThemeColors() {
	const [
		accent,
		mutedForeground,
		destructive,
		success,
		borderStrong,
		foreground,
		accentForeground,
		warning,
	] = useCSSVariable([
		"--color-accent",
		"--color-muted-foreground",
		"--color-destructive",
		"--color-success",
		"--color-border-strong",
		"--color-foreground",
		"--color-accent-foreground",
		"--color-warning",
	]);
	return {
		accent: String(accent ?? LIGHT_FALLBACK.accent),
		mutedForeground: String(mutedForeground ?? LIGHT_FALLBACK.mutedForeground),
		destructive: String(destructive ?? LIGHT_FALLBACK.destructive),
		success: String(success ?? LIGHT_FALLBACK.success),
		/** Off-state track for switches. */
		borderStrong: String(borderStrong ?? LIGHT_FALLBACK.borderStrong),
		foreground: String(foreground ?? LIGHT_FALLBACK.foreground),
		/** Icons on an accent fill, e.g. a primary button's leading icon. */
		accentForeground: String(
			accentForeground ?? LIGHT_FALLBACK.accentForeground,
		),
		warning: String(warning ?? LIGHT_FALLBACK.warning),
	};
}

export type ThemeColors = ReturnType<typeof useThemeColors>;

const LIGHT_FALLBACK = {
	accent: "#f3bc00",
	mutedForeground: "#64748b",
	destructive: "#dc2626",
	success: "#16a34a",
	borderStrong: "#cbd5e1",
	foreground: "#0f172a",
	accentForeground: "#3f2e00",
	warning: "#d97706",
};
